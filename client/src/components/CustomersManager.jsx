import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function CustomersManager() {
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', marketingConsent: false });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await API.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
    }
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
    if (!window.confirm(`Are you sure you want to delete or archive customer "${c.name}"?`)) {
      return;
    }
    try {
      const res = await API.delete(`/customers/${c._id}`);
      alert(res.data.message || 'Customer removed');
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const validateForm = () => {
    const rawName = String(formData.name || '').trim();
    if (!rawName) return 'Customer name is required';
    if (rawName.length < 2) return 'Customer name must be at least 2 characters';
    if (rawName.length > 60) return 'Customer name cannot exceed 60 characters';
    if (!/[a-zA-Z\u00C0-\u024F\u0600-\u06FF]/.test(rawName)) return 'Customer name must contain at least one letter';
    if (!/^[a-zA-Z\u00C0-\u024F\u0600-\u06FF\s'’.\-]+$/.test(rawName)) return 'Customer name can only contain letters, spaces, hyphens, periods, and apostrophes';

    const rawPhone = String(formData.phone || '').trim();
    if (!rawPhone) return 'Phone number is required';
    if (/[a-zA-Z]/.test(rawPhone)) return 'Phone number cannot contain letters';
    if (/[^\d\s\-+().]/.test(rawPhone)) return 'Phone number contains invalid characters';
    const digitsOnly = rawPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) return 'Phone number is too short';
    if (digitsOnly.length > 13) return 'Phone number is too long';
    const pakPhoneRegex = /^(?:(?:\+92|0092|92)|0)[2-9]\d{8,9}$/;
    const cleanedPhone = rawPhone.replace(/[\s\-().]/g, '');
    if (!pakPhoneRegex.test(cleanedPhone)) return 'Please enter a valid Pakistani phone number (e.g., 03001234567 or +923001234567)';

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
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      if (editCustomer) {
        await API.put(`/customers/${editCustomer._id}`, formData);
      } else {
        await API.post('/customers', formData);
      }
      setFormData({ name: '', phone: '', email: '', marketingConsent: false });
      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save customer');
    }
  };

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>Customers</h2>
        <button className="btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>SMS Consent</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c._id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.phone}</td>
                <td>{c.email || 'N/A'}</td>
                <td>
                  <span className={`badge ${c.marketingConsent ? 'success' : 'secondary'}`}>
                    {c.marketingConsent ? 'Opted In' : 'No'}
                  </span>
                </td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="icon-btn" onClick={() => handleOpenEdit(c)} title="Edit Customer">
                    <Edit size={16} />
                  </button>
                  <button className="icon-btn danger" onClick={() => handleDelete(c)} title="Delete Customer">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{editCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
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
                  value={formData.phone}
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
