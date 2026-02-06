import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { activityTypes, todayDate } from '../utils.js';

export default function ActivityForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: '', type: 'run', distanceKm: '', date: todayDate(),
    hours: '', minutes: '', seconds: '', notes: '', dogIds: [],
  });
  const [dogs, setDogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const allDogs = await api.getDogs();
        setDogs(allDogs);

        if (isEdit) {
          const activity = await api.getActivity(id);
          const totalSec = activity.duration_seconds || 0;
          const h = Math.floor(totalSec / 3600);
          const m = Math.floor((totalSec % 3600) / 60);
          const s = totalSec % 60;
          setForm({
            title: activity.title,
            type: activity.type,
            distanceKm: activity.distance_km || '',
            date: activity.date,
            hours: h || '',
            minutes: m || '',
            seconds: s || '',
            notes: activity.notes || '',
            dogIds: activity.dogs?.map(d => d.id) || [],
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isEdit]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const toggleDog = (dogId) => {
    setForm(prev => ({
      ...prev,
      dogIds: prev.dogIds.includes(dogId)
        ? prev.dogIds.filter(id => id !== dogId)
        : [...prev.dogIds, dogId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const durationSeconds =
      (parseInt(form.hours) || 0) * 3600 +
      (parseInt(form.minutes) || 0) * 60 +
      (parseInt(form.seconds) || 0);

    const payload = {
      title: form.title,
      type: form.type,
      distanceKm: parseFloat(form.distanceKm) || 0,
      durationSeconds,
      date: form.date,
      notes: form.notes || null,
      dogIds: form.dogIds,
    };

    try {
      if (isEdit) {
        await api.updateActivity(id, payload);
      } else {
        await api.createActivity(payload);
      }
      navigate('/activities');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <Link to="/activities" className="back-link">&larr; Back to Activities</Link>
      <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>
        {isEdit ? 'Edit Activity' : 'Add Activity'}
      </h1>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input type="text" className="form-input" value={form.title}
              onChange={update('title')} required placeholder="e.g. Morning trail run" autoFocus />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={update('type')}>
                {activityTypes().map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date}
                onChange={update('date')} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Distance (km)</label>
            <input type="number" className="form-input" value={form.distanceKm}
              onChange={update('distanceKm')} step="0.01" min="0" placeholder="0.0" />
          </div>

          <div className="form-group">
            <label className="form-label">Duration</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div>
                <input type="number" className="form-input" value={form.hours}
                  onChange={update('hours')} min="0" placeholder="Hours" />
              </div>
              <div>
                <input type="number" className="form-input" value={form.minutes}
                  onChange={update('minutes')} min="0" max="59" placeholder="Minutes" />
              </div>
              <div>
                <input type="number" className="form-input" value={form.seconds}
                  onChange={update('seconds')} min="0" max="59" placeholder="Seconds" />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Dogs</label>
            {dogs.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                No dogs added yet. <Link to="/dogs">Add dogs first</Link>
              </p>
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
              onChange={update('notes')} placeholder="How did it go?" />
          </div>

          <div className="btn-group">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Activity')}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/activities')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
