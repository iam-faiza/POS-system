import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Shield, Plus, Edit, Trash2, Search, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import AccessibleDialog from './AccessibleDialog';
import { useToast } from '../context/ToastContext';
import { isAdminUser } from '../utils/roles';
import { groupPermissionsByModule } from '../utils/featureAccess';

export default function RolesManager({ user }) {
  const { showToast } = useToast();
  const [roles, setRoles] = useState([]);
  const [permissionRegistry, setPermissionRegistry] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', permissions: [] });
  
  // NEW: State for presets and dropdown selection
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const canManageRoles = isAdminUser(user) || user?.permissions?.includes('roles.manage');

  useEffect(() => {
    fetchRoles();
    fetchPresets();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await API.get('/roles');
      setRoles(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await API.get('/roles/permissions');
      if (Array.isArray(res.data)) setPermissionRegistry(res.data);
    } catch (err) {
      console.error('Failed to load permission registry', err);
    }
  };

  // NEW: Fetch role templates/presets from backend
  const fetchPresets = async () => {
    try {
      const res = await API.get('/roles/presets');
      if (Array.isArray(res.data)) setPresets(res.data);
    } catch (err) {
      console.error('Failed to load role presets', err);
    }
  };

  // NEW: Handle preset selection
  const handlePresetChange = (e) => {
    const presetName = e.target.value;
    setSelectedPreset(presetName);

    if (!presetName) {
      setFormData({ name: '', description: '', permissions: [] });
      return;
    }

    const found = presets.find((p) => p.name === presetName);
    if (found) {
      setFormData({
        name: found.name,
        description: found.description || '',
        permissions: found.permissions || []
      });
    }
  };

  const handleOpenAdd = () => {
    setEditRole(null);
    setSelectedPreset('');
    setFormData({ name: '', description: '', permissions: [] });
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (role) => {
    setEditRole(role);
    setSelectedPreset('');
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || []
    });
    setError('');
    setShowModal(true);
  };

  const handlePermissionToggle = (permKey) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permKey);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== permKey)
          : [...prev.permissions, permKey]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editRole) {
        await API.put(`/roles/${editRole._id}`, formData);
        setFeedback({ type: 'success', message: 'Role updated successfully' });
      } else {
        await API.post('/roles', formData);
        setFeedback({ type: 'success', message: 'Role created successfully' });
      }
      setShowModal(false);
      fetchRoles();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (role) => {
    if (role.isSystemRole) {
      showToast('System roles cannot be deleted.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the role "${role.name}"?`)) return;
    setFeedback(null);
    try {
      const res = await API.delete(`/roles/${role._id}`);
      setFeedback({ type: 'success', message: res.data.message || 'Role deleted successfully' });
      fetchRoles();
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to delete role' });
    }
  };

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>Role & Permission Management</h2>
        <div className="toolbar">
          <div className="search-box">
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {canManageRoles && (
            <button className="btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} /> Add Custom Role
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={feedback.type === 'success' ? 'success-alert' : 'error-alert'}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>Type</th>
              <th>Permissions Assigned</th>
              {canManageRoles && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRoles.map((role) => (
              <tr key={role._id}>
                <td>
                  <div className="cell-inline">
                    <Shield size={16} color="var(--brand)" />
                    <strong>{role.name}</strong>
                  </div>
                </td>
                <td>{role.description || <span className="muted">No description</span>}</td>
                <td>
                  <span className={`badge ${role.isSystemRole ? 'primary' : 'secondary'}`}>
                    {role.isSystemRole ? 'System Role' : 'Custom Role'}
                  </span>
                </td>
                <td>
                  <span className="badge success">
                    {role.permissions?.length || 0} permissions
                  </span>
                </td>
                {canManageRoles && (
                  <td>
                    <button
                      className="icon-btn"
                      onClick={() => handleOpenEdit(role)}
                      title="Edit Role"
                      aria-label={`Edit ${role.name}`}
                    >
                      <Edit size={16} />
                    </button>
                    {!role.isSystemRole ? (
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(role)}
                        title="Delete Role"
                        aria-label={`Delete ${role.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <span title="System roles cannot be deleted" className="lock-hint">
                        <Lock size={16} />
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filteredRoles.length === 0 && (
              <tr>
                <td colSpan={canManageRoles ? 5 : 4} className="empty-cell">
                  No roles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AccessibleDialog className="modal modal-lg" labelledBy="role-dialog-title" onClose={() => setShowModal(false)}>
          <h3 id="role-dialog-title">{editRole ? `Edit Role: ${editRole.name}` : 'Create Custom Role'}</h3>
          {error && <div className="error-alert">{error}</div>}
          <form onSubmit={handleSubmit} className="modal-form">
            
          {/* NEW: Role Template Preset Dropdown */}
            {!editRole && (
              <div className="form-group">
                <label htmlFor="role-preset">Role Template (Optional Quick-Fill)</label>
                <select
                  id="role-preset"
                  value={selectedPreset}
                  onChange={handlePresetChange}
                >
                  <option value="">-- Custom Role / Blank --</option>
                  {presets.length === 0 ? (
                    <option disabled value="">Loading templates...</option>
                  ) : (
                    presets.map((preset) => (
                      <option key={preset.name} value={preset.name}>
                        {preset.name} - {preset.description}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="role-name">Role Name</label>
              <input
                id="role-name"
                type="text"
                placeholder="e.g. Inventory Manager"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={editRole?.isSystemRole}
              />
              {editRole?.isSystemRole && <small className="muted">System role names cannot be modified.</small>}
            </div>

            <div className="form-group">
              <label htmlFor="role-desc">Description</label>
              <input
                id="role-desc"
                type="text"
                placeholder="Brief summary of responsibilities"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Permissions by Module</label>
              <div className="perm-grid">
                {groupPermissionsByModule(permissionRegistry).map((mod) => (
                  <div key={mod.title} className="perm-group">
                    <strong className="perm-group-title">
                      {mod.title}
                    </strong>
                    {mod.permissions.map((perm) => (
                      <label key={perm.key} className="perm-item">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.key)}
                          onChange={() => handlePermissionToggle(perm.key)}
                        />
                        <span>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save Role'}
              </button>
            </div>
          </form>
        </AccessibleDialog>
      )}
    </div>
  );
}