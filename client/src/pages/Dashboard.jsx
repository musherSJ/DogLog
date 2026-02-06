import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { formatDuration, formatDistance, formatDate, activityIcon } from '../utils.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [dogs, setDogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getActivities(), api.getDogs()])
      .then(([s, a, d]) => { setStats(s); setActivities(a.slice(0, 5)); setDogs(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Welcome, {user.displayName}</h1>
        <div className="btn-group">
          <Link to="/record" className="btn btn-success">Record Activity</Link>
          <Link to="/activities/new" className="btn btn-primary">Add Manual</Link>
        </div>
      </div>

      {stats && (
        <>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>This Week</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.recentWeek.activities}</div>
              <div className="stat-label">Activities</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDistance(stats.recentWeek.distance_km)}</div>
              <div className="stat-label">Distance (km)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(stats.recentWeek.duration_seconds)}</div>
              <div className="stat-label">Duration</div>
            </div>
          </div>

          <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Time</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.overall.total_activities}</div>
              <div className="stat-label">Activities</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDistance(stats.overall.total_distance_km)}</div>
              <div className="stat-label">Total km</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(stats.overall.total_duration_seconds)}</div>
              <div className="stat-label">Total Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dogs.length}</div>
              <div className="stat-label">Dogs</div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Activities</span>
          <Link to="/activities" className="btn btn-outline btn-sm">View all</Link>
        </div>
        {activities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#127939;</div>
            <p>No activities yet. Record or add your first one!</p>
          </div>
        ) : (
          activities.map(a => (
            <Link to={`/activities/${a.id}/edit`} key={a.id} className="activity-item" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="activity-icon">{activityIcon(a.type)}</div>
              <div className="activity-info">
                <div className="activity-title">{a.title}</div>
                <div className="activity-meta">
                  <span>{formatDate(a.date)}</span>
                  <span>{formatDistance(a.distance_km)} km</span>
                  <span>{formatDuration(a.duration_seconds)}</span>
                </div>
                {a.dogs?.length > 0 && (
                  <div className="activity-dogs" style={{ marginTop: '0.25rem' }}>
                    {a.dogs.map(d => <span key={d.id} className="dog-tag">{d.name}</span>)}
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
