import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Shield, Plus, Edit, Trash2, Search, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import AccessibleDialog from './AccessibleDialog';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { isAdminUser } from '../utils/roles';

const PERMISSION_MODULES = [
  {
    title: 'Dashboard',
    permissions: [
      { key: 'dashboard.view_own', label: 'View Own Dashboard' },
      { key: 'dashboard.view_team', label: 'View Team Dashboard' }
    ]
  },
  {
    title: 'Sales & POS',
    permissions: [
      { key: 'sales.create', label: 'Create Sales / Checkout' },
      { key: 'sales.view_own', label: 'View Own Sales' },
      { key: 'sales.view_all', label: 'View All Sales History' }
    ]
  },
  {
    title: 'Products & Categories',
    permissions: [
      { key: 'products.view', label: 'View Products' },
      { key: 'products.manage', label: 'Manage Products & Categories' }
    ]
  },
  {
    title: 'Inventory',
    permissions: [
      { key: 'inventory.view', label: 'View Inventory' },
      { key: 'inventory.manage', label: 'Manage Inventory Adjustments' }
    ]
  },
  {
    title: 'Customers',
    permissions: [
      { key: 'customers.view', label: 'View Customers' },
      { key: 'customers.create', label: 'Create Customers' },
      { key: 'customers.manage', label: 'Manage & Archive Customers' }
    ]
  },
  {
    title: 'Administration & Staff',
    permissions: [
      { key: 'employees.manage', label: 'Manage Employees' },
      { key: 'roles.manage', label: 'Manage Roles & Permissions' }
    ]
  }
];

export default function RolesManager({ user }) {
  const { t } = useSettings();
  const { showToast } = useToast();
  const [roles, setRoles] = useState([]);
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
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await API.get('/roles');
      setRoles(res.data);
    } catch (err) {
      console.error(err);
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="search-box" style={{ background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-input)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '14px', width: '200px', background: 'transparent', color: 'var(--text-primary)' }}
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
        <div className={feedback.type === 'success' ? 'success-alert' : 'error-alert'} style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color="var(--brand)" />
                    <strong>{role.name}</strong>
                  </div>
                </td>
                <td>{role.description || <span style={{ color: 'var(--text-muted)' }}>No description</span>}</td>
                <td>
                  <span className={`badge ${role.isSystemRole ? 'primary' : 'secondary'}`}>
                    {role.isSystemRole ? 'System Role' : 'Custom Role'}
                  </span>
                </td>
                <td>
                  <span className="badge success" style={{ fontSize: '12px' }}>
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
                      <span title="System roles cannot be deleted" style={{ padding: '6px', display: 'inline-flex', opacity: 0.5 }}>
                        <Lock size={16} />
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filteredRoles.length === 0 && (
              <tr>
                <td colSpan={canManageRoles ? 5 : 4} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No roles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AccessibleDialog className="modal" labelledBy="role-dialog-title" onClose={() => setShowModal(false)} style={{ maxWidth: '700px', width: '90%' }}>
          <h3 id="role-dialog-title">{editRole ? `Edit Role: ${editRole.name}` : 'Create Custom Role'}</h3>
          {error && <div className="error-alert">{error}</div>}
          <form onSubmit={handleSubmit} className="modal-form">
            
          {/* NEW: Role Template Preset Dropdown */}
            {!editRole && (
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label htmlFor="role-preset">Role Template (Optional Quick-Fill)</label>
                <select
                  id="role-preset"
                  value={selectedPreset}
                  onChange={handlePresetChange}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
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
              {editRole?.isSystemRole && <small style={{ color: 'var(--text-muted)' }}>System role names cannot be modified.</small>}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', maxHeight: '320px', overflowY: 'auto', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-input)' }}>
                {PERMISSION_MODULES.map((mod) => (
                  <div key={mod.title} style={{ marginBottom: '10px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--brand)', display: 'block', marginBottom: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px' }}>
                      {mod.title}
                    </strong>
                    {mod.permissions.map((perm) => (
                      <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.key)}
                          onChange={() => handlePermissionToggle(perm.key)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
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