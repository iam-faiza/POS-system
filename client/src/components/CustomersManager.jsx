import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';
import { Plus, Edit, Trash2, Search, AlertCircle, CheckCircle, RotateCcw, Archive } from 'lucide-react';

export default function CustomersManager({ user }) {
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archived'
  const [customers, setCustomers] = useState([]);
  const [archivedCustomers, setArchivedCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', marketingConsent: false });
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [archivedSearchQuery, setArchivedSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const searchTimeoutRef = useRef(null);
  const archivedSearchTimeoutRef = useRef(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchCustomers();
    if (isAdmin) fetchArchivedCustomers();
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (archivedSearchTimeoutRef.current) clearTimeout(archivedSearchTimeoutRef.current);
    };
  }, []);

  const fetchCustomers = async (query = '') => {
    try {
      const res = await API.get(`/customers${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchArchivedCustomers = async (query = '') => {
    try {
      const res = await API.get(`/customers/archived${query ? `?search=${encodeURIComponent(query)}` : ''}`);
      setArchivedCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => fetchCustomers(query), 300);
  };

  const handleArchivedSearch = (e) => {
    const query = e.target.value;
    setArchivedSearchQuery(query);
    if (archivedSearchTimeoutRef.current) clearTimeout(archivedSearchTimeoutRef.current);
    archivedSearchTimeoutRef.current = setTimeout(() => fetchArchivedCustomers(query), 300);
  };

  const handleOpenAdd = () => {
    setEditCustomer(null);
    setError('');
    setFormData({ name: '', phone: '', email: '', marketingConsent: false });
    setShowModal(true);
  };

  const handleOpenEdit = (c) => {
    setEditCustomer(c);
    setError('');
    setFormData({
      name: c.name,
      phone: c.phone,
      email: c.email || '',
      marketingConsent: c.marketingConsent || false
    });
    setShowModal(true);
  };

  const handleDelete = async (c) => {
    const confirmMsg = `Are you sure you want to archive customer "${c.name}"?\n\nIf this customer has past sales, their record will be safely archived to protect historical receipts.`;
    if (!window.confirm(confirmMsg)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await API.delete(`/customers/${c._id}`);
      setFeedback({ type: 'success', message: res.data.message || 'Customer removed successfully' });
      fetchCustomers(searchQuery);
      if (isAdmin) fetchArchivedCustomers(archivedSearchQuery);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to delete customer' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (c) => {
    if (!window.confirm(`Restore "${c.name}" to the active customer list?`)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await API.patch(`/customers/${c._id}/restore`);
      setFeedback({ type: 'success', message: res.data.message || 'Customer restored successfully' });
      fetchCustomers(searchQuery);
      fetchArchivedCustomers(archivedSearchQuery);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to restore customer' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (customers.length === 0) {
      alert('There are no active customer records to delete.');
      return;
    }
    const confirmMsg =
      `⚠️ WARNING: ARE YOU SURE YOU WANT TO DELETE ALL CUSTOMERS?\n\n` +
      `• This operation will process ALL customer records.\n` +
      `• Customers with past sales will be safely archived to preserve receipts and sales records.\n` +
      `• Customers without sales will be permanently removed.\n\n` +
      `Are you sure you want to proceed?`;
    if (!window.confirm(confirmMsg)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await API.delete('/customers');
      setFeedback({ type: 'success', message: res.data.message });
      fetchCustomers(searchQuery);
      if (isAdmin) fetchArchivedCustomers(archivedSearchQuery);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to delete all customers' });
    } finally {
      setActionLoading(false);
    }
  };

  const validateForm = () => {
    const rawName = String(formData.name || '').trim();
    if (!rawName) return 'Customer name is required';
    if (rawName.length < 2) return 'Customer name must be at least 2 characters';
    if (rawName.length > 60) return 'Customer name cannot exceed 60 characters';
    if (!/[a-zA-Z\u00C0-\u024F\u0600-\u06FF]/.test(rawName)) return 'Customer name must contain at least one letter';
    if (!/^[a-zA-Z\u00C0-\u024F\u0600-\u06FF\s''.\\-]+$/.test(rawName)) return 'Customer name can only contain letters, spaces, hyphens, periods, and apostrophes';

    // For archived customers being edited, phone may have the archived_ prefix — skip phone validation in that case
    const rawPhone = String(formData.phone || '').trim();
    if (!rawPhone) return 'Phone number is required';
    if (!rawPhone.startsWith('archived_')) {
      if (/[a-zA-Z]/.test(rawPhone)) return 'Phone number cannot contain letters';
      if (/[^\d\s\-+().]/.test(rawPhone)) return 'Phone number contains invalid characters';
      const digitsOnly = rawPhone.replace(/\D/g, '');
      if (digitsOnly.length < 10) return 'Phone number is too short';
      if (digitsOnly.length > 13) return 'Phone number is too long';
      const pakPhoneRegex = /^(?:(?:\+92|0092|92)|0)[2-9]\d{8,9}$/;
      const cleanedPhone = rawPhone.replace(/[\s\-().]/g, '');
      if (!pakPhoneRegex.test(cleanedPhone)) return 'Please enter a valid Pakistani phone number (e.g., 03001234567 or +923001234567)';
    }

    const email = String(formData.email || '').trim();
    if (email !== '') {
      if (/\s/.test(email)) return 'Email cannot contain spaces';
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!emailRegex.test(email)) return 'Please enter a valid email address';
      const parts = email.split('@');
      const domainParts = parts[1]?.split('.') || [];
      const tld = domainParts[domainParts.length - 1] || '';
      if (domainParts.length < 2 || tld.length < 2) return 'Please enter a valid email address';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    try {
      if (editCustomer) {
        await API.put(`/customers/${editCustomer._id}`, formData);
        setFeedback({ type: 'success', message: 'Customer updated successfully' });
      } else {
        await API.post('/customers', formData);
        setFeedback({ type: 'success', message: 'Customer added successfully' });
      }
      setFormData({ name: '', phone: '', email: '', marketingConsent: false });
      setShowModal(false);
      fetchCustomers(searchQuery);
      if (isAdmin) fetchArchivedCustomers(archivedSearchQuery);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save customer');
    }
  };

  const displayedList = activeTab === 'active' ? customers : archivedCustomers;

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>Customers</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeTab === 'active' ? (
            <div className="search-box" style={{ background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-input)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search name, phone, or email..."
                value={searchQuery}
                onChange={handleSearch}
                style={{ border: 'none', outline: 'none', fontSize: '14px', width: '220px', background: 'transparent', color: 'var(--text-primary)' }}
              />
            </div>
          ) : (
            <div className="search-box" style={{ background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-input)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search archived customers..."
                value={archivedSearchQuery}
                onChange={handleArchivedSearch}
                style={{ border: 'none', outline: 'none', fontSize: '14px', width: '220px', background: 'transparent', color: 'var(--text-primary)' }}
              />
            </div>
          )}
          {isAdmin && activeTab === 'active' && (
            <button
              className="btn-danger"
              onClick={handleBulkDelete}
              disabled={actionLoading}
              title="Delete all customer records"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={16} /> Delete All Customers
            </button>
          )}
          {activeTab === 'active' && (
            <button className="btn-primary" onClick={handleOpenAdd} disabled={actionLoading}>
              <Plus size={16} /> Add Customer
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
          <button
            onClick={() => setActiveTab('active')}
            style={{
              padding: '8px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              color: activeTab === 'active' ? 'var(--brand)' : 'var(--text-muted)',
              borderBottom: activeTab === 'active' ? '2px solid var(--brand)' : '2px solid transparent',
              transition: 'color 0.2s',
              marginBottom: '-1px'
            }}
          >
            Active Customers ({customers.length})
          </button>
          <button
            onClick={() => { setActiveTab('archived'); fetchArchivedCustomers(archivedSearchQuery); }}
            style={{
              padding: '8px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              color: activeTab === 'archived' ? 'var(--brand)' : 'var(--text-muted)',
              borderBottom: activeTab === 'archived' ? '2px solid var(--brand)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color 0.2s',
              marginBottom: '-1px'
            }}
          >
            <Archive size={14} /> Archived Customers ({archivedCustomers.length})
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={feedback.type === 'success' ? 'success-alert' : 'error-alert'}
          style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`
          }}
        >
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>SMS Consent</th>
              <th>Registered</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {displayedList.map((c) => (
              <tr key={c._id}>
                <td>
                  <strong>{c.name}</strong>
                  {activeTab === 'archived' && (
                    <span className="badge warning" style={{ marginLeft: '8px', fontSize: '11px' }}>
                      Archived
                    </span>
                  )}
                </td>
                <td>{c.phone.startsWith('archived_') ? c.phone.split('_').slice(2).join('_') || c.phone : c.phone}</td>
                <td>{c.email || 'N/A'}</td>
                <td>
                  <span className={`badge ${c.marketingConsent ? 'success' : 'secondary'}`}>
                    {c.marketingConsent ? 'Opted In' : 'No'}
                  </span>
                </td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                {isAdmin && (
                  <td>
                    <button
                      className="icon-btn"
                      onClick={() => handleOpenEdit(c)}
                      title="Edit Customer"
                      disabled={actionLoading}
                    >
                      <Edit size={16} />
                    </button>
                    {activeTab === 'archived' ? (
                      <button
                        className="icon-btn"
                        onClick={() => handleRestore(c)}
                        title="Restore Customer"
                        disabled={actionLoading}
                        style={{ color: '#059669' }}
                      >
                        <RotateCcw size={16} />
                      </button>
                    ) : (
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(c)}
                        title="Archive Customer"
                        disabled={actionLoading}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {displayedList.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5}
                  style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}
                >
                  {activeTab === 'active'
                    ? (searchQuery ? `No customers found matching "${searchQuery}".` : 'No active customers registered yet.')
                    : (archivedSearchQuery ? `No archived customers found matching "${archivedSearchQuery}".` : 'No archived customers.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{editCustomer ? (activeTab === 'archived' ? 'Edit Archived Customer' : 'Edit Customer') : 'Add New Customer'}</h3>
            {error && <div className="error-alert">{error}</div>}
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 03001234567"
                  value={formData.phone.startsWith('archived_') ? formData.phone.split('_').slice(2).join('_') || formData.phone : formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <input
                  type="checkbox"
                  id="marketingConsent"
                  checked={formData.marketingConsent}
                  onChange={(e) => setFormData({ ...formData, marketingConsent: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="marketingConsent" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
                  Opt-in for Marketing SMS
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
