import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDuration, formatDistance, formatDate, formatPace, activityIcon } from '../utils.js';

export default function DogDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDogStats(id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!data) return <div className="empty-state"><p>Dog not found</p></div>;

  const { dog, stats, activities } = data;

  return (
    <div>
      <Link to="/dogs" className="back-link">&larr; Back to Dogs</Link>

      <div className="card" style={{ textAlign: 'center', paddingTop: '2rem' }}>
        <div className="dog-avatar" style={{ width: 72, height: 72, fontSize: '2.5rem', margin: '0 auto 0.75rem' }}>
          &#128054;
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{dog.name}</h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
          {[dog.breed, dog.weight_kg ? `${dog.weight_kg} kg` : null, dog.birth_date ? `Born ${formatDate(dog.birth_date)}` : null]
            .filter(Boolean).join(' \u00B7 ')}
        </p>
        {dog.notes && <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--gray-600)' }}>{dog.notes}</p>}
      </div>

      <h3 style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Statistics</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total_activities}</div>
          <div className="stat-label">Activities</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDistance(stats.total_distance_km)}</div>
          <div className="stat-label">Total km</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDuration(stats.total_duration_seconds)}</div>
          <div className="stat-label">Total Time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatPace(stats.total_distance_km, stats.total_duration_seconds)}</div>
          <div className="stat-label">Avg Pace</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDistance(stats.avg_distance_km)}</div>
          <div className="stat-label">Avg Distance</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatDuration(Math.round(stats.avg_duration_seconds))}</div>
          <div className="stat-label">Avg Duration</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Activity History</span>
        </div>
        {activities.length === 0 ? (
          <div className="empty-state">
            <p>No activities recorded for {dog.name} yet.</p>
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
                {a.dogs?.length > 1 && (
                  <div className="activity-dogs" style={{ marginTop: '0.25rem' }}>
                    {a.dogs.filter(d => d.id !== Number(id)).map(d => (
                      <span key={d.id} className="dog-tag">{d.name}</span>
                    ))}
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
