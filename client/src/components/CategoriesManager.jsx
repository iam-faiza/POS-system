import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Edit, Plus, Trash2 } from 'lucide-react';
import AccessibleDialog from './AccessibleDialog';
import { useSettings } from '../context/SettingsContext';
import { isAdminUser } from '../utils/roles';

export default function CategoriesManager({ user }) {
  const { t } = useSettings();
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const isAdmin = isAdminUser(user);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await API.get('/categories');
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    if (normalizedName.length < 2 || normalizedName.length > 60 ||
        !/[\p{L}\p{N}]/u.test(normalizedName) || !/^[\p{L}\p{N}\s&().'-]+$/u.test(normalizedName)) {
      setError(t('category_name_error'));
      return;
    }
    try {
      if (editCategory) await API.put(`/categories/${editCategory._id}`, { name: normalizedName });
      else await API.post('/categories', { name: normalizedName });
      setName('');
      setEditCategory(null);
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.message || t('category_create_failed'));
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(`${t('category_delete_confirm')} (${category.name})`)) return;
    setActionError('');
    try {
      await API.delete(`/categories/${category._id}`);
      await fetchCategories();
    } catch (err) {
      setActionError(err.response?.data?.message || t('category_delete_failed'));
    }
  };

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>{t('categories')}</h2>
        {isAdmin && (
          <button className="btn-primary" onClick={() => { setEditCategory(null); setName(''); setError(''); setShowModal(true); }}>
            <Plus size={16} /> {t('add_category')}
          </button>
        )}
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('category_name')}</th>
              <th>{t('category_created_at')}</th>
              {isAdmin && <th>{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c._id}>
                <td><strong>{c.name}</strong></td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                {isAdmin && (
                  <td>
                    <button className="icon-btn" title="Edit category" aria-label={`Edit ${c.name}`} onClick={() => { setEditCategory(c); setName(c.name); setError(''); setShowModal(true); }}>
                      <Edit size={16} />
                    </button>
                    <button className="icon-btn danger" title="Delete category" aria-label={`Delete ${c.name}`} onClick={() => handleDelete(c)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actionError && <div className="error-alert" role="alert">{actionError}</div>}

      {showModal && (
        <AccessibleDialog className="modal" labelledBy="category-dialog-title" onClose={() => setShowModal(false)}>
            <h3 id="category-dialog-title">{editCategory ? t('edit_category') : t('add_category')}</h3>
            {error && <div className="error-alert">{error}</div>}
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="category-name">{t('category_name')}</label>
                <input
                  id="category-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={60}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
        </AccessibleDialog>
      )}
    </div>
  );
}
