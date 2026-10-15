import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';
import { Plus, Edit, Trash2, Search, AlertCircle, CheckCircle, RotateCcw, Archive } from 'lucide-react';
import { localizeCustomerValidationError, originalArchivedPhone, validateCustomerDetails } from '../utils/customerValidation';
import AccessibleDialog from './AccessibleDialog';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { isAdminUser } from '../utils/roles';

export default function CustomersManager({ user }) {
  const { t } = useSettings();
  const { showToast } = useToast();
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

  const isAdmin = isAdminUser(user);

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
      name: c.name.endsWith(' (Archived)') ? c.name.slice(0, -' (Archived)'.length) : c.name,
      phone: originalArchivedPhone(c.phone),
      email: c.email || '',
      marketingConsent: c.marketingConsent || false
    });
    setShowModal(true);
  };

  const handleDelete = async (c) => {
    const confirmMsg = `${t('archive_customer_confirm')}\n\n${c.name}`;
    if (!window.confirm(confirmMsg)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await API.delete(`/customers/${c._id}`);
      setFeedback({ type: 'success', message: res.data.message || t('customer_remove_failed') });
      fetchCustomers(searchQuery);
      if (isAdmin) fetchArchivedCustomers(archivedSearchQuery);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || t('customer_archive_failed') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (c) => {
    if (!window.confirm(`${t('restore_customer')}\n\n${c.name}`)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await API.patch(`/customers/${c._id}/restore`);
      setFeedback({ type: 'success', message: res.data.message || 'Customer restored successfully' });
      fetchCustomers(searchQuery);
      fetchArchivedCustomers(archivedSearchQuery);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || t('customer_restore_failed') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (customers.length === 0) {
      showToast(t('no_active_customers_to_delete'), 'error');
      return;
    }
    const confirmMsg = t('confirm_bulk_customer_delete');
    if (!window.confirm(confirmMsg)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await API.delete('/customers');
      setFeedback({ type: 'success', message: res.data.message });
      fetchCustomers(searchQuery);
      if (isAdmin) fetchArchivedCustomers(archivedSearchQuery);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || t('bulk_customer_failed') });
    } finally {
      setActionLoading(false);
    }
  };

  const validateForm = () => {
    return localizeCustomerValidationError(validateCustomerDetails(formData).error, t);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    try {
      if (editCustomer) {
        await API.put(`/customers/${editCustomer._id}`, formData);
        setFeedback({ type: 'success', message: t('customer_updated') });
      } else {
        await API.post('/customers', formData);
        setFeedback({ type: 'success', message: t('customer_added') });
      }
      setFormData({ name: '', phone: '', email: '', marketingConsent: false });
      setShowModal(false);
      fetchCustomers(searchQuery);
      if (isAdmin) fetchArchivedCustomers(archivedSearchQuery);
    } catch (err) {
      setError(localizeCustomerValidationError(err.response?.data?.message || t('customer_save_failed'), t));
    }
  };

  const displayedList = activeTab === 'active' ? customers : archivedCustomers;

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>{t('customers')}</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeTab === 'active' ? (
            <div className="search-box" style={{ background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-input)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                aria-label={t('filter_customers')}
                placeholder={t('filter_customers')}
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
                aria-label={t('search_archived_customers')}
                placeholder={t('search_archived_customers')}
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
              title={t('delete_all_customers')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={16} /> {t('delete_all_customers')}
            </button>
          )}
          {isAdmin && activeTab === 'active' && (
            <button className="btn-primary" onClick={handleOpenAdd} disabled={actionLoading}>
              <Plus size={16} /> {t('add_customer')}
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
            {t('active_customers')} ({customers.length})
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
            <Archive size={14} /> {t('archived_customers')} ({archivedCustomers.length})
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
              <th>{t('customer_name')}</th>
              <th>{t('phone')}</th>
              <th>{t('email')}</th>
              <th>{t('sms_consent')}</th>
              <th>{t('registered')}</th>
              {isAdmin && <th>{t('actions')}</th>}
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
                <td>{originalArchivedPhone(c.phone)}</td>
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
                      title={t('edit_customer')}
                      disabled={actionLoading}
                    >
                      <Edit size={16} />
                    </button>
                    {activeTab === 'archived' ? (
                      <button
                        className="icon-btn"
                        onClick={() => handleRestore(c)}
                        title={t('restore_customer')}
                        disabled={actionLoading}
                      >
                        <RotateCcw size={16} />
                      </button>
                    ) : (
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(c)}
                        title={t('archive_customer')}
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
                    ? (searchQuery ? `${t('no_customers')} (${searchQuery})` : t('no_active_customers'))
                    : (archivedSearchQuery ? `${t('no_customers')} (${archivedSearchQuery})` : t('no_archived_customers'))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AccessibleDialog className="modal" labelledBy="customer-dialog-title" onClose={() => setShowModal(false)}>
            <h3 id="customer-dialog-title">{editCustomer ? (activeTab === 'archived' ? t('edit_archived_customer') : t('edit_customer')) : t('add_customer_title')}</h3>
            {error && <div className="error-alert">{error}</div>}
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="customer-name">{t('customer_name')}</label>
                <input
                  id="customer-name"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="customer-phone">{t('phone')}</label>
                <input
                  id="customer-phone"
                  type="text"
                  placeholder="e.g. 03001234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="customer-email">{t('email_optional')}</label>
                <input
                  id="customer-email"
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
                  {t('marketing_opt_in')}
                </label>
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
