import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDuration, formatDistance, activityTypes, todayDate } from '../utils.js';

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function RecordActivity() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | recording | paused | saving
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [track, setTrack] = useState([]);
  const [geoError, setGeoError] = useState('');
  const [dogs, setDogs] = useState([]);

  // Save form
  const [showSave, setShowSave] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'run', notes: '', dogIds: [] });
  const [saving, setSaving] = useState(false);

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedElapsedRef = useRef(0);
  const lastPosRef = useRef(null);

  useEffect(() => {
    api.getDogs().then(setDogs).catch(console.error);
    return () => {
      stopWatching();
      clearInterval(timerRef.current);
    };
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return false;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError('');
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          time: Date.now(),
          accuracy: pos.coords.accuracy,
        };

        if (lastPosRef.current && pos.coords.accuracy < 50) {
          const d = haversineDistance(
            lastPosRef.current.lat, lastPosRef.current.lng,
            point.lat, point.lng
          );
          if (d > 0.002) { // ignore very small movements (GPS jitter)
            setDistance(prev => prev + d);
            lastPosRef.current = point;
          }
        } else if (!lastPosRef.current) {
          lastPosRef.current = point;
        }

        setTrack(prev => [...prev, point]);
      },
      (err) => {
        setGeoError(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return true;
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startRecording = () => {
    const ok = startWatching();
    if (ok === false) return;
    setStatus('recording');
    startTimeRef.current = Date.now();
    pausedElapsedRef.current = elapsed;
    timerRef.current = setInterval(() => {
      setElapsed(pausedElapsedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const pauseRecording = () => {
    setStatus('paused');
    clearInterval(timerRef.current);
    pausedElapsedRef.current = elapsed;
    stopWatching();
  };

  const resumeRecording = () => {
    setStatus('recording');
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(pausedElapsedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    startWatching();
  };

  const finishRecording = () => {
    clearInterval(timerRef.current);
    stopWatching();
    setShowSave(true);
  };

  const discardRecording = () => {
    if (!confirm('Discard this activity?')) return;
    clearInterval(timerRef.current);
    stopWatching();
    setStatus('idle');
    setElapsed(0);
    setDistance(0);
    setTrack([]);
    lastPosRef.current = null;
    pausedElapsedRef.current = 0;
  };

  const toggleDog = (dogId) => {
    setForm(prev => ({
      ...prev,
      dogIds: prev.dogIds.includes(dogId)
        ? prev.dogIds.filter(id => id !== dogId)
        : [...prev.dogIds, dogId],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createActivity({
        title: form.title || `${form.type.charAt(0).toUpperCase() + form.type.slice(1)} Activity`,
        type: form.type,
        distanceKm: Math.round(distance * 100) / 100,
        durationSeconds: elapsed,
        date: todayDate(),
        notes: form.notes || null,
        dogIds: form.dogIds,
        gpsTrack: track.length > 0 ? track : null,
      });
      navigate('/activities');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Save form overlay
  if (showSave) {
    return (
      <div>
        <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>Save Activity</h1>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{formatDistance(distance)}</div>
            <div className="stat-label">Distance (km)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatDuration(elapsed)}</div>
            <div className="stat-label">Duration</div>
          </div>
        </div>

        <div className="card">
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input type="text" className="form-input" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Morning trail run" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}>
                {activityTypes().map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dogs</label>
              {dogs.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>No dogs added yet.</p>
              ) : (
                <div className="dog-checkbox-list">
                  {dogs.map(dog => (
                    <label key={dog.id}
                      className={`dog-checkbox ${form.dogIds.includes(dog.id) ? 'selected' : ''}`}
                      onClick={() => toggleDog(dog.id)}>
                      <input type="checkbox" checked={form.dogIds.includes(dog.id)}
                        onChange={() => {}} style={{ display: 'none' }} />
                      {dog.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="How did it go?" />
            </div>
            <div className="btn-group">
              <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                {saving ? 'Saving...' : 'Save Activity'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowSave(false)}>
                Back
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="record-overlay">
      <div className="record-map">
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: '0.875rem' }}>
              &larr; Cancel
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
              {track.length > 0 ? `${track.length} GPS points` : 'Waiting for GPS...'}
            </span>
          </div>
        </div>
        {geoError && (
          <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', background: 'rgba(220,38,38,0.9)', color: 'white', padding: '0.75rem', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
            {geoError}
          </div>
        )}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
          {status === 'idle' && <p style={{ fontSize: '1.25rem' }}>Press start to begin recording</p>}
          {status === 'recording' && <p style={{ fontSize: '1.25rem' }}>Recording...</p>}
          {status === 'paused' && <p style={{ fontSize: '1.25rem' }}>Paused</p>}
        </div>
      </div>

      <div className="record-panel">
        <div className="record-stats">
          <div>
            <div className="record-stat-value">{formatDistance(distance)}</div>
            <div className="record-stat-label">km</div>
          </div>
          <div>
            <div className="record-stat-value">{formatDuration(elapsed)}</div>
            <div className="record-stat-label">Duration</div>
          </div>
          <div>
            <div className="record-stat-value">
              {distance > 0.01 ? formatDuration(Math.round(elapsed / distance)) : '-'}
            </div>
            <div className="record-stat-label">Pace /km</div>
          </div>
        </div>

        <div className="record-actions">
          {status === 'idle' && (
            <button className="record-btn idle" onClick={startRecording}>
              &#9654;
            </button>
          )}
          {status === 'recording' && (
            <>
              <button className="btn btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                onClick={discardRecording}>
                Discard
              </button>
              <button className="record-btn recording" onClick={pauseRecording}>
                &#10074;&#10074;
              </button>
              <button className="btn btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                onClick={finishRecording}>
                Finish
              </button>
            </>
          )}
          {status === 'paused' && (
            <>
              <button className="btn btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                onClick={discardRecording}>
                Discard
              </button>
              <button className="record-btn paused" onClick={resumeRecording}>
                &#9654;
              </button>
              <button className="btn btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                onClick={finishRecording}>
                Finish
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
