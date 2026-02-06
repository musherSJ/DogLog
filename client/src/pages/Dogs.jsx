import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Dogs() {
  const [dogs, setDogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDog, setEditDog] = useState(null);
  const [form, setForm] = useState({ name: '', breed: '', birthDate: '', weightKg: '', notes: '' });
  const [error, setError] = useState('');

  const load = () => {
    api.getDogs().then(setDogs).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: '', breed: '', birthDate: '', weightKg: '', notes: '' });
    setEditDog(null);
    setShowForm(false);
    setError('');
  };

  const openEdit = (dog, e) => {
    e.preventDefault();
    e.stopPropagation();
    setForm({
      name: dog.name,
      breed: dog.breed || '',
      birthDate: dog.birth_date || '',
      weightKg: dog.weight_kg || '',
      notes: dog.notes || ''
    });
    setEditDog(dog);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        name: form.name,
        breed: form.breed || null,
        birthDate: form.birthDate || null,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
        notes: form.notes || null,
      };
      if (editDog) {
        await api.updateDog(editDog.id, payload);
      } else {
        await api.createDog(payload);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (dog, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete ${dog.name}? This will also remove them from all activities.`)) return;
    try {
      await api.deleteDog(dog.id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Dogs</h1>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          + Add Dog
        </button>
      </div>

      {dogs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128054;</div>
          <p>No dogs added yet. Add your first dog!</p>
        </div>
      ) : (
        dogs.map(dog => (
          <Link to={`/dogs/${dog.id}`} key={dog.id} className="dog-card">
            <div className="dog-avatar">&#128054;</div>
            <div className="dog-info">
              <div className="dog-name">{dog.name}</div>
              <div className="dog-breed">
                {[dog.breed, dog.weight_kg ? `${dog.weight_kg} kg` : null].filter(Boolean).join(' \u00B7 ')}
              </div>
            </div>
            <div className="btn-group">
              <button className="btn btn-outline btn-sm" onClick={(e) => openEdit(dog, e)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(dog, e)}>Delete</button>
            </div>
          </Link>
        ))
      )}

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editDog ? 'Edit Dog' : 'Add Dog'}</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input type="text" className="form-input" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Breed</label>
                  <input type="text" className="form-input" value={form.breed}
                    onChange={e => setForm({ ...form, breed: e.target.value })} placeholder="e.g. Alaskan Husky" />
                </div>
                <div className="form-group">
                  <label className="form-label">Weight (kg)</label>
                  <input type="number" className="form-input" value={form.weightKg} step="0.1"
                    onChange={e => setForm({ ...form, weightKg: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Birth Date</label>
                <input type="date" className="form-input" value={form.birthDate}
                  onChange={e => setForm({ ...form, birthDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this dog..." />
              </div>
              <div className="btn-group">
                <button type="submit" className="btn btn-primary">{editDog ? 'Save Changes' : 'Add Dog'}</button>
                <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
