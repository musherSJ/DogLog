import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { formatDuration, formatDistance, formatPace, activityIcon } from '../utils.js';

export default function Profile() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [dogs, setDogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getDogs()])
      .then(([s, d]) => { setStats(s); setDogs(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <div className="card" style={{ textAlign: 'center', paddingTop: '2rem' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: 'var(--primary-light)',
          color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', margin: '0 auto 0.75rem', fontWeight: 700
        }}>
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{user.displayName}</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>@{user.username}</p>
        <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
          {dogs.length} dog{dogs.length !== 1 ? 's' : ''} registered
        </p>
      </div>

      {stats && (
        <>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Statistics</h3>
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
              <div className="stat-value">{formatPace(stats.overall.total_distance_km, stats.overall.total_duration_seconds)}</div>
              <div className="stat-label">Avg Pace</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDistance(stats.overall.avg_distance_km)}</div>
              <div className="stat-label">Avg Distance</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatDuration(Math.round(stats.overall.avg_duration_seconds))}</div>
              <div className="stat-label">Avg Duration</div>
            </div>
          </div>

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

          {stats.byType.length > 0 && (
            <>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>By Activity Type</h3>
              <div className="card">
                {stats.byType.map(t => (
                  <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span style={{ fontSize: '1.25rem' }}>{activityIcon(t.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{t.type}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                        {t.count} activities
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                      <div>{formatDistance(t.total_distance_km)} km</div>
                      <div style={{ color: 'var(--gray-500)' }}>{formatDuration(t.total_duration_seconds)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button className="btn btn-outline" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
