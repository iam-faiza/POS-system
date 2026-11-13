import React, { useEffect, useState } from 'react';
import { Lock, Delete } from 'lucide-react';
import API from '../services/api';

export default function LockScreen({ user, onUnlock }) {
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [hasPin, setHasPin] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadPinStatus = () => API.get('/auth/lock/status')
    .then((response) => setHasPin(Boolean(response.data?.hasPin)))
    .catch((requestError) => {
      setStatusError(requestError.response?.data?.message || 'Unable to check unlock settings. Try again.');
    });

  useEffect(() => {
    loadPinStatus();
  }, []);

  const verifyUnlock = async (credentialName, credential) => {
    setLoading(true);
    setError('');
    try {
      await API.post('/auth/unlock', { [credentialName]: credential });
      onUnlock();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to unlock the register.');
      setPin('');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (num) => {
    if (hasPin && !loading && pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        verifyUnlock('pin', nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  return (
    <div className="lock-screen-overlay">
      <div className="lock-glass-card">
        <div className="lock-avatar-badge">
          <Lock size={28} />
        </div>

        <h2 className="lock-title">Terminal Locked</h2>
        <p className="lock-subtitle">
          Cashier: <strong>{user?.name || 'Active Cashier'}</strong>
        </p>

        {statusError ? (
          <>
            <div className="lock-error-alert" role="alert">{statusError}</div>
            <button type="button" className="btn-secondary" onClick={() => { setStatusError(''); loadPinStatus(); }}>Retry</button>
          </>
        ) : hasPin === null ? (
          <p role="status">Checking unlock settings...</p>
        ) : hasPin ? (
          <>
            <p className="lock-hint">Enter your personal PIN</p>
            <div className="pin-dots-container" aria-label={`${pin.length} of 4 digits entered`}>
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className={`pin-dot ${pin.length > idx ? 'filled' : ''}`} />
              ))}
            </div>
            {error && <div className="lock-error-alert" role="alert">{error}</div>}
            <div className="keypad-grid">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button key={num} type="button" className="keypad-btn" onClick={() => handleKeyPress(num)} disabled={loading}>
                  {num}
                </button>
              ))}
              <button type="button" className="keypad-btn action-btn" onClick={handleClear} disabled={loading}>C</button>
              <button type="button" className="keypad-btn" onClick={() => handleKeyPress('0')} disabled={loading}>0</button>
              <button type="button" className="keypad-btn action-btn" onClick={handleDelete} aria-label="Delete" disabled={loading}>
                <Delete size={20} />
              </button>
            </div>
          </>
        ) : (
          <form className="lock-password-form" onSubmit={(event) => {
            event.preventDefault();
            if (password) verifyUnlock('password', password);
          }}>
            <p className="lock-hint">Enter your account password to unlock</p>
            <input
              type="password"
              autoComplete="current-password"
              aria-label="Account password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error && <div className="lock-error-alert" role="alert">{error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Verifying...' : 'Unlock register'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}