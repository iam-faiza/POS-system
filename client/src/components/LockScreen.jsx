import React, { useState } from 'react';
import { Lock, Delete } from 'lucide-react';

export default function LockScreen({ user, onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // Default quick PIN is 1234 or user.pin if present
  const CORRECT_PIN = user?.pin || '1234';

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        if (nextPin === CORRECT_PIN) {
          onUnlock();
        } else {
          setError('Incorrect PIN. Try again.');
          setPin('');
        }
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

        <div className="pin-dots-container">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`pin-dot ${pin.length > idx ? 'filled' : ''}`}
            />
          ))}
        </div>

        {error && <div className="lock-error-alert">{error}</div>}

        <div className="keypad-grid">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              className="keypad-btn"
              onClick={() => handleKeyPress(num)}
            >
              {num}
            </button>
          ))}
          <button type="button" className="keypad-btn action-btn" onClick={handleClear}>
            C
          </button>
          <button type="button" className="keypad-btn" onClick={() => handleKeyPress('0')}>
            0
          </button>
          <button type="button" className="keypad-btn action-btn" onClick={handleDelete} aria-label="Delete">
            <Delete size={20} />
          </button>
        </div>

        <p className="lock-hint">Default PIN: 1234</p>
      </div>
    </div>
  );
}