import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDuration, formatDistance, formatDate, activityIcon } from '../utils.js';

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getActivities().then(setActivities).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (activity, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${activity.title}"?`)) return;
    try {
      await api.deleteActivity(activity.id);
      setActivities(prev => prev.filter(a => a.id !== activity.id));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Activities</h1>
        <div className="btn-group">
          <Link to="/record" className="btn btn-success">Record</Link>
          <Link to="/activities/new" className="btn btn-primary">+ Add Manual</Link>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#127939;</div>
          <p>No activities yet. Record or add your first activity!</p>
        </div>
      ) : (
        <div className="card">
          {activities.map(a => (
            <div key={a.id} className="activity-item">
              <Link to={`/activities/${a.id}/edit`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, textDecoration: 'none', color: 'inherit' }}>
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
              <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(a, e)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
