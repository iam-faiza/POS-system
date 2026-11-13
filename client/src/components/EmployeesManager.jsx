import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Users, Plus, Trash2, Search, CheckCircle, AlertCircle, Shield, Mail, Lock } from 'lucide-react';
import AccessibleDialog from './AccessibleDialog';
import { useToast } from '../context/ToastContext';
import { isAdminUser } from '../utils/roles';

export default function EmployeesManager({ user }) {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', roleRef: '' });
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const canManageEmployees = isAdminUser(user) || user?.permissions?.includes('employees.manage');
  const isAdminTarget = (employee) => String(employee.roleRef?.name || employee.role || '').toLowerCase() === 'admin';

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await API.get('/employees');
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await API.get('/roles');
      setRoles(res.data);
      if (res.data.length > 0 && !formData.roleRef) {
        setFormData((prev) => ({ ...prev, roleRef: res.data[0]._id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      roleRef: roles[0]?._id || ''
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await API.post('/employees', formData);
      setFeedback({ type: 'success', message: 'Employee registered successfully' });
      setShowModal(false);
      fetchEmployees();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register employee');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (emp) => {
    if (emp._id === (user?._id || user?.id)) {
      showToast('You cannot delete your own account.', 'error');
      return;
    }
    if (isAdminTarget(emp) && !isAdminUser(user)) {
      showToast('Only an administrator can manage administrator accounts.', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove employee "${emp.name}"?`)) return;
    setFeedback(null);
    try {
      await API.delete(`/employees/${emp._id}`);
      setFeedback({ type: 'success', message: 'Employee removed successfully' });
      fetchEmployees();
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to delete employee' });
    }
  };

  const filteredEmployees = employees.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>Employee Management</h2>
        <div className="toolbar">
          <div className="search-box">
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {canManageEmployees && (
            <button className="btn-primary" onClick={handleOpenAdd}>
              <Plus size={16} /> Register Employee
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
              <th>Employee Name</th>
              <th>Email (Login ID)</th>
              <th>Assigned Role</th>
              <th>Registered Date</th>
              {canManageEmployees && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp._id}>
                <td>
                  <div className="cell-inline">
                    <Users size={16} color="var(--brand)" />
                    <strong>{emp.name}</strong>
                  </div>
                </td>
                <td>{emp.email}</td>
                <td>
                  <span className="badge primary">
                    <Shield size={12} />
                    {emp.roleRef?.name || emp.role}
                  </span>
                </td>
                <td>{new Date(emp.createdAt).toLocaleDateString()}</td>
                {canManageEmployees && (
                  <td>
                    {emp._id !== (user?._id || user?.id) && (!isAdminTarget(emp) || isAdminUser(user)) ? (
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(emp)}
                        title="Remove Employee"
                        aria-label={`Remove ${emp.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <span className="muted text-xs">Current User</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={canManageEmployees ? 5 : 4} className="empty-cell">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AccessibleDialog className="modal modal-md" labelledBy="employee-dialog-title" onClose={() => setShowModal(false)}>
          <h3 id="employee-dialog-title">Register New Employee</h3>
          {error && <div className="error-alert">{error}</div>}
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-group">
              <label htmlFor="emp-name">Full Name</label>
              <input
                id="emp-name"
                type="text"
                placeholder="e.g. Jane Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="emp-email"><Mail size={14} /> Email Address (Login)</label>
              <input
                id="emp-email"
                type="email"
                placeholder="e.g. jane@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="emp-password"><Lock size={14} /> Password</label>
              <input
                id="emp-password"
                type="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={6}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="emp-role">Assign Role</label>
              <select
                id="emp-role"
                value={formData.roleRef}
                onChange={(e) => setFormData({ ...formData, roleRef: e.target.value })}
                required
              >
                {roles.map((role) => (
                  <option key={role._id} value={role._id}>
                    {role.name} ({role.permissions?.length || 0} permissions)
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Registering...' : 'Register Employee'}
              </button>
            </div>
          </form>
        </AccessibleDialog>
      )}
    </div>
  );
}