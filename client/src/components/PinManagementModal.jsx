import React, { useEffect, useState } from 'react';
import API from '../services/api';
import AccessibleDialog from './AccessibleDialog';

const emptyValues = { currentPin: '', pin: '', confirmPin: '' };

export default function PinManagementModal({ onClose }) {
  const [hasPin, setHasPin] = useState(null);
  const [action, setAction] = useState(null);
  const [values, setValues] = useState(emptyValues);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = () => API.get('/auth/pin/status')
    .then((response) => setHasPin(Boolean(response.data?.hasPin)))
    .catch((requestError) => {
      setError(requestError.response?.data?.message || 'Unable to load PIN settings. Try again.');
    });

  useEffect(() => {
    loadStatus();
  }, []);

  const updateValue = (field, value) => {
    if (!/^\d{0,4}$/.test(value)) return;
    setValues((current) => ({ ...current, [field]: value }));
    setError('');
    setMessage('');
  };

  const clearForm = () => setValues(emptyValues);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(values.pin)) {
      setError('PIN must contain exactly four digits.');
      return;
    }
    if (values.confirmPin !== values.pin) {
      setError('PIN confirmation does not match.');
      return;
    }
    if (hasPin && !/^\d{4}$/.test(values.currentPin)) {
      setError('Enter your current four-digit PIN.');
      return;
    }

    setBusy(true);
    try {
      const response = await API.post('/auth/pin', {
        pin: values.pin,
        confirmPin: values.confirmPin,
        ...(hasPin ? { currentPin: values.currentPin } : {})
      });
      setHasPin(Boolean(response.data?.hasPin));
      setMessage(response.data?.message || 'PIN saved successfully.');
      setAction(null);
      clearForm();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save PIN.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (event) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(values.currentPin)) {
      setError('Enter your current four-digit PIN.');
      return;
    }
    if (!window.confirm('Remove your personal unlock PIN?')) return;

    setBusy(true);
    try {
      const response = await API.delete('/auth/pin', { data: { currentPin: values.currentPin } });
      setHasPin(Boolean(response.data?.hasPin));
      setMessage(response.data?.message || 'PIN removed successfully.');
      setAction(null);
      clearForm();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to remove PIN.');
    } finally {
      setBusy(false);
    }
  };

  const chooseAction = (nextAction) => {
    setAction(nextAction);
    clearForm();
    setError('');
    setMessage('');
  };

  return (
    <AccessibleDialog className="modal pin-management-modal" labelledBy="pin-settings-title" onClose={onClose}>
      <h2 id="pin-settings-title">Personal Unlock PIN</h2>
      {hasPin === null && !error && <p role="status">Loading PIN settings...</p>}
      {error && <div className="error-alert" role="alert">{error}</div>}
      {message && <div className="success-alert" role="status">{message}</div>}

      {hasPin === null ? (
        error && <button type="button" className="btn-secondary" onClick={() => { setError(''); loadStatus(); }}>Retry</button>
      ) : hasPin ? (
        <>
          {!action && (
            <div className="pin-management-options">
              <button type="button" className="btn-secondary" onClick={() => chooseAction('update')}>Update PIN</button>
              <button type="button" className="btn-danger" onClick={() => chooseAction('remove')}>Remove PIN</button>
            </div>
          )}
          {action === 'update' && (
            <form className="pin-management-form" onSubmit={handleSave}>
              <PinField id="current-pin" label="Current PIN" value={values.currentPin} onChange={(value) => updateValue('currentPin', value)} />
              <PinField id="new-pin" label="New four-digit PIN" value={values.pin} onChange={(value) => updateValue('pin', value)} />
              <PinField id="confirm-pin" label="Confirm new PIN" value={values.confirmPin} onChange={(value) => updateValue('confirmPin', value)} />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => chooseAction(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Update PIN'}</button>
              </div>
            </form>
          )}
          {action === 'remove' && (
            <form className="pin-management-form" onSubmit={handleRemove}>
              <PinField id="remove-current-pin" label="Current PIN" value={values.currentPin} onChange={(value) => updateValue('currentPin', value)} />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => chooseAction(null)}>Cancel</button>
                <button type="submit" className="btn-danger" disabled={busy}>{busy ? 'Removing...' : 'Confirm removal'}</button>
              </div>
            </form>
          )}
        </>
      ) : (
        <form className="pin-management-form" onSubmit={handleSave}>
          <p>Set a personal four-digit PIN to unlock this register faster. PIN setup is optional.</p>
          <PinField id="new-pin" label="New four-digit PIN" value={values.pin} onChange={(value) => updateValue('pin', value)} />
          <PinField id="confirm-pin" label="Confirm PIN" value={values.confirmPin} onChange={(value) => updateValue('confirmPin', value)} />
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Set PIN'}</button>
          </div>
        </form>
      )}
    </AccessibleDialog>
  );
}

function PinField({ id, label, value, onChange }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        pattern="[0-9]{4}"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}
