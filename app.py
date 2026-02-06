import os
import sqlite3
import secrets
import hashlib
import hmac
import json
import time
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory, g
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

app = Flask(__name__, static_folder='static', static_url_path='')

SECRET_KEY = os.environ.get('SECRET_KEY', secrets.token_hex(64))
TOKEN_MAX_AGE = 7 * 24 * 3600  # 7 days
serializer = URLSafeTimedSerializer(SECRET_KEY)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'doglog.db')


# --- Password hashing (stdlib only, no bcrypt needed) ---

def hash_password(password):
    salt = secrets.token_hex(32)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return salt + ':' + h.hex()


def verify_password(password, stored):
    salt, expected = stored.split(':', 1)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return hmac.compare_digest(h.hex(), expected)


# --- Database ---

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA journal_mode=WAL')
        g.db.execute('PRAGMA foreign_keys=ON')
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS dogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            breed TEXT,
            birth_date TEXT,
            weight_kg REAL,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'run',
            distance_km REAL DEFAULT 0,
            duration_seconds INTEGER DEFAULT 0,
            date TEXT NOT NULL,
            notes TEXT,
            gps_track TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS activity_dogs (
            activity_id INTEGER NOT NULL,
            dog_id INTEGER NOT NULL,
            PRIMARY KEY (activity_id, dog_id),
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
            FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE
        );
    ''')
    db.close()


# --- Auth helpers ---

def generate_token(user_id):
    return serializer.dumps({'uid': user_id})


def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401
        try:
            data = serializer.loads(header[7:], max_age=TOKEN_MAX_AGE)
            g.user_id = data['uid']
        except SignatureExpired:
            return jsonify({'error': 'Token expired'}), 401
        except BadSignature:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


# --- Helpers ---

def attach_dogs(db, activities):
    for a in activities:
        dogs = db.execute(
            'SELECT d.id, d.name FROM dogs d JOIN activity_dogs ad ON d.id = ad.dog_id WHERE ad.activity_id = ?',
            (a['id'],)
        ).fetchall()
        a['dogs'] = [{'id': d['id'], 'name': d['name']} for d in dogs]


def row_to_dict(row):
    return dict(row) if row else None


def rows_to_dicts(rows):
    return [dict(r) for r in rows]


# --- Static files ---

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


# --- User routes ---

@app.route('/api/users/register', methods=['POST'])
def register():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    display_name = (data.get('displayName') or '').strip()

    if not username or not password or not display_name:
        return jsonify({'error': 'Username, password, and display name are required'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    db = get_db()
    if db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone():
        return jsonify({'error': 'Username already taken'}), 409

    pw_hash = hash_password(password)
    cur = db.execute(
        'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
        (username, pw_hash, display_name)
    )
    db.commit()
    user_id = cur.lastrowid
    token = generate_token(user_id)
    return jsonify({'token': token, 'user': {'id': user_id, 'username': username, 'displayName': display_name}}), 201


@app.route('/api/users/login', methods=['POST'])
def login():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    db = get_db()
    user = row_to_dict(db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone())
    if not user or not verify_password(password, user['password_hash']):
        return jsonify({'error': 'Invalid username or password'}), 401

    token = generate_token(user['id'])
    return jsonify({'token': token, 'user': {'id': user['id'], 'username': user['username'], 'displayName': user['display_name']}})


@app.route('/api/users/me')
@auth_required
def get_me():
    db = get_db()
    user = row_to_dict(db.execute('SELECT id, username, display_name, created_at FROM users WHERE id = ?', (g.user_id,)).fetchone())
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'id': user['id'], 'username': user['username'], 'displayName': user['display_name'], 'createdAt': user['created_at']})


# --- Dog routes ---

@app.route('/api/dogs')
@auth_required
def get_dogs():
    db = get_db()
    dogs = rows_to_dicts(db.execute('SELECT * FROM dogs WHERE user_id = ? ORDER BY name', (g.user_id,)).fetchall())
    return jsonify(dogs)


@app.route('/api/dogs/<int:dog_id>')
@auth_required
def get_dog(dog_id):
    db = get_db()
    dog = row_to_dict(db.execute('SELECT * FROM dogs WHERE id = ? AND user_id = ?', (dog_id, g.user_id)).fetchone())
    if not dog:
        return jsonify({'error': 'Dog not found'}), 404
    return jsonify(dog)


@app.route('/api/dogs', methods=['POST'])
@auth_required
def create_dog():
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400

    db = get_db()
    cur = db.execute(
        'INSERT INTO dogs (user_id, name, breed, birth_date, weight_kg, notes) VALUES (?, ?, ?, ?, ?, ?)',
        (g.user_id, name, data.get('breed'), data.get('birthDate'), data.get('weightKg'), data.get('notes'))
    )
    db.commit()
    dog = row_to_dict(db.execute('SELECT * FROM dogs WHERE id = ?', (cur.lastrowid,)).fetchone())
    return jsonify(dog), 201


@app.route('/api/dogs/<int:dog_id>', methods=['PUT'])
@auth_required
def update_dog(dog_id):
    db = get_db()
    dog = row_to_dict(db.execute('SELECT * FROM dogs WHERE id = ? AND user_id = ?', (dog_id, g.user_id)).fetchone())
    if not dog:
        return jsonify({'error': 'Dog not found'}), 404

    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400

    db.execute(
        'UPDATE dogs SET name=?, breed=?, birth_date=?, weight_kg=?, notes=? WHERE id=?',
        (name, data.get('breed'), data.get('birthDate'), data.get('weightKg'), data.get('notes'), dog_id)
    )
    db.commit()
    return jsonify(row_to_dict(db.execute('SELECT * FROM dogs WHERE id = ?', (dog_id,)).fetchone()))


@app.route('/api/dogs/<int:dog_id>', methods=['DELETE'])
@auth_required
def delete_dog(dog_id):
    db = get_db()
    dog = row_to_dict(db.execute('SELECT * FROM dogs WHERE id = ? AND user_id = ?', (dog_id, g.user_id)).fetchone())
    if not dog:
        return jsonify({'error': 'Dog not found'}), 404
    db.execute('DELETE FROM dogs WHERE id = ?', (dog_id,))
    db.commit()
    return jsonify({'success': True})


@app.route('/api/dogs/<int:dog_id>/stats')
@auth_required
def get_dog_stats(dog_id):
    db = get_db()
    dog = row_to_dict(db.execute('SELECT * FROM dogs WHERE id = ? AND user_id = ?', (dog_id, g.user_id)).fetchone())
    if not dog:
        return jsonify({'error': 'Dog not found'}), 404

    stats = row_to_dict(db.execute('''
        SELECT COUNT(a.id) as total_activities,
            COALESCE(SUM(a.distance_km), 0) as total_distance_km,
            COALESCE(SUM(a.duration_seconds), 0) as total_duration_seconds,
            COALESCE(AVG(a.distance_km), 0) as avg_distance_km,
            COALESCE(AVG(a.duration_seconds), 0) as avg_duration_seconds
        FROM activities a JOIN activity_dogs ad ON a.id = ad.activity_id
        WHERE ad.dog_id = ? AND a.user_id = ?
    ''', (dog_id, g.user_id)).fetchone())

    activities = rows_to_dicts(db.execute('''
        SELECT a.* FROM activities a JOIN activity_dogs ad ON a.id = ad.activity_id
        WHERE ad.dog_id = ? AND a.user_id = ? ORDER BY a.date DESC
    ''', (dog_id, g.user_id)).fetchall())
    attach_dogs(db, activities)

    return jsonify({'dog': dog, 'stats': stats, 'activities': activities})


# --- Activity routes ---

@app.route('/api/activities')
@auth_required
def get_activities():
    db = get_db()
    activities = rows_to_dicts(db.execute('SELECT * FROM activities WHERE user_id = ? ORDER BY date DESC', (g.user_id,)).fetchall())
    attach_dogs(db, activities)
    return jsonify(activities)


@app.route('/api/activities/stats')
@auth_required
def get_activity_stats():
    db = get_db()
    overall = row_to_dict(db.execute('''
        SELECT COUNT(*) as total_activities,
            COALESCE(SUM(distance_km), 0) as total_distance_km,
            COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
            COALESCE(AVG(distance_km), 0) as avg_distance_km,
            COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds
        FROM activities WHERE user_id = ?
    ''', (g.user_id,)).fetchone())

    by_type = rows_to_dicts(db.execute('''
        SELECT type, COUNT(*) as count,
            COALESCE(SUM(distance_km), 0) as total_distance_km,
            COALESCE(SUM(duration_seconds), 0) as total_duration_seconds
        FROM activities WHERE user_id = ? GROUP BY type
    ''', (g.user_id,)).fetchall())

    recent_week = row_to_dict(db.execute('''
        SELECT COUNT(*) as activities,
            COALESCE(SUM(distance_km), 0) as distance_km,
            COALESCE(SUM(duration_seconds), 0) as duration_seconds
        FROM activities WHERE user_id = ? AND date >= date('now', '-7 days')
    ''', (g.user_id,)).fetchone())

    return jsonify({'overall': overall, 'byType': by_type, 'recentWeek': recent_week})


@app.route('/api/activities/<int:activity_id>')
@auth_required
def get_activity(activity_id):
    db = get_db()
    activity = row_to_dict(db.execute('SELECT * FROM activities WHERE id = ? AND user_id = ?', (activity_id, g.user_id)).fetchone())
    if not activity:
        return jsonify({'error': 'Activity not found'}), 404
    attach_dogs(db, [activity])
    return jsonify(activity)


@app.route('/api/activities', methods=['POST'])
@auth_required
def create_activity():
    data = request.get_json()
    title = (data.get('title') or '').strip()
    date = data.get('date')
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    if not date:
        return jsonify({'error': 'Date is required'}), 400

    gps = json.dumps(data['gpsTrack']) if data.get('gpsTrack') else None

    db = get_db()
    cur = db.execute(
        'INSERT INTO activities (user_id, title, type, distance_km, duration_seconds, date, notes, gps_track) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (g.user_id, title, data.get('type', 'run'), data.get('distanceKm', 0), data.get('durationSeconds', 0), date, data.get('notes'), gps)
    )
    activity_id = cur.lastrowid

    for dog_id in (data.get('dogIds') or []):
        dog = db.execute('SELECT id FROM dogs WHERE id = ? AND user_id = ?', (dog_id, g.user_id)).fetchone()
        if dog:
            db.execute('INSERT INTO activity_dogs (activity_id, dog_id) VALUES (?, ?)', (activity_id, dog_id))
    db.commit()

    activity = row_to_dict(db.execute('SELECT * FROM activities WHERE id = ?', (activity_id,)).fetchone())
    attach_dogs(db, [activity])
    return jsonify(activity), 201


@app.route('/api/activities/<int:activity_id>', methods=['PUT'])
@auth_required
def update_activity(activity_id):
    db = get_db()
    activity = row_to_dict(db.execute('SELECT * FROM activities WHERE id = ? AND user_id = ?', (activity_id, g.user_id)).fetchone())
    if not activity:
        return jsonify({'error': 'Activity not found'}), 404

    data = request.get_json()
    title = (data.get('title') or '').strip()
    date = data.get('date')
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    if not date:
        return jsonify({'error': 'Date is required'}), 400

    gps = json.dumps(data['gpsTrack']) if data.get('gpsTrack') else activity['gps_track']

    db.execute(
        'UPDATE activities SET title=?, type=?, distance_km=?, duration_seconds=?, date=?, notes=?, gps_track=? WHERE id=?',
        (title, data.get('type', 'run'), data.get('distanceKm', 0), data.get('durationSeconds', 0), date, data.get('notes'), gps, activity_id)
    )
    db.execute('DELETE FROM activity_dogs WHERE activity_id = ?', (activity_id,))
    for dog_id in (data.get('dogIds') or []):
        dog = db.execute('SELECT id FROM dogs WHERE id = ? AND user_id = ?', (dog_id, g.user_id)).fetchone()
        if dog:
            db.execute('INSERT INTO activity_dogs (activity_id, dog_id) VALUES (?, ?)', (activity_id, dog_id))
    db.commit()

    updated = row_to_dict(db.execute('SELECT * FROM activities WHERE id = ?', (activity_id,)).fetchone())
    attach_dogs(db, [updated])
    return jsonify(updated)


@app.route('/api/activities/<int:activity_id>', methods=['DELETE'])
@auth_required
def delete_activity(activity_id):
    db = get_db()
    activity = row_to_dict(db.execute('SELECT * FROM activities WHERE id = ? AND user_id = ?', (activity_id, g.user_id)).fetchone())
    if not activity:
        return jsonify({'error': 'Activity not found'}), 404
    db.execute('DELETE FROM activities WHERE id = ?', (activity_id,))
    db.commit()
    return jsonify({'success': True})


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.environ.get('FLASK_DEBUG', '0') == '1')
