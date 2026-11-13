import React, { useState, useEffect } from 'react';
import { LogOut, User, Sun, Moon, Globe, DollarSign, Clock, ShoppingCart, Lock, KeyRound } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { canConvertCurrency } from '../utils/i18n';
import API from '../services/api';
import ShiftModal from './ShiftModal';
import PinManagementModal from './PinManagementModal';

export default function Navbar({ user, onLogout, onLock, isSidebarCollapsed }) {
  const { theme, toggleTheme, language, setLanguage, currency, setCurrency, availableCurrencies, t } = useSettings();
  const [activeShift, setActiveShift] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [lockError, setLockError] = useState('');

  const handleLock = async () => {
    setLockError('');
    try {
      await API.post('/auth/lock');
      onLock();
    } catch (requestError) {
      setLockError(requestError.response?.data?.message || 'Unable to lock the POS session.');
    }
  };

  const checkShift = () => {
    if (user) {
      API.get('/shifts/current')
        .then((res) => setActiveShift(res.data?.activeShift || null))
        .catch(() => setActiveShift(null));
    }
  };

  useEffect(() => {
    checkShift();
    window.addEventListener('shiftUpdated', checkShift);
    return () => window.removeEventListener('shiftUpdated', checkShift);
  }, [user]);

  const handleShiftUpdate = (updatedShift) => {
    setActiveShift(updatedShift);
    window.dispatchEvent(new Event('shiftUpdated'));
  };

  return (
    <>
      <header className="top-header">
        <div className="header-left">
          {isSidebarCollapsed && (
            <div className="collapsed-brand">
              <ShoppingCart size={22} />
              <span>RetailPOS</span>
            </div>
          )}
        </div>

        <div className="header-right">
          {/* Currency Selector */}
          <div className="nav-setting-select" title={t('currency')}>
            <DollarSign size={15} />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="header-select"
              aria-label="Display Currency"
            >
              {availableCurrencies.map((c) => (
                <option key={c.code} value={c.code} disabled={!canConvertCurrency(c.code)}>
                  {c.code} ({c.symbol}){!canConvertCurrency(c.code) ? ` - ${t('unavailable')}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Language Selector */}
          <div className="nav-setting-select" title={t('language')}>
            <Globe size={15} />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="header-select"
              aria-label="Interface Language"
            >
              <option value="en">English</option>
              <option value="ur">اردو</option>
            </select>
          </div>

          {/* Dark / Light Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* Shift Button */}
          <button
            type="button"
            onClick={() => setShowShiftModal(true)}
            className={`shift-pill-btn ${activeShift ? 'active' : ''}`}
            title="Manage Register Shift & Z-Report"
          >
            <Clock size={16} />
            <span>{activeShift ? 'Shift Active' : 'Open Shift'}</span>
          </button>

          {/* Terminal Lock Button */}
          <button
            type="button"
            onClick={handleLock}
            className="theme-toggle-btn"
            title="Lock Register Screen"
            aria-label="Lock Register Screen"
          >
            <Lock size={18} />
          </button>
          {lockError && <span className="lock-error-alert" role="alert">{lockError}</span>}

          <button
            type="button"
            onClick={() => setShowPinModal(true)}
            className="theme-toggle-btn"
            title="Manage personal unlock PIN"
            aria-label="Manage personal unlock PIN"
          >
            <KeyRound size={18} />
          </button>

          {/* User Info */}
          <div className="nav-user">
            <div className="user-info">
              <User size={16} />
              <span>{user?.name}</span>
              <span className={`role-badge ${String(user?.role || '').toLowerCase()}`}>{user?.role}</span>
            </div>
            <button onClick={onLogout} className="logout-btn" title={t('logout')} aria-label={t('logout')}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {showShiftModal && (
        <ShiftModal
          activeShift={activeShift}
          onShiftUpdated={handleShiftUpdate}
          onClose={() => setShowShiftModal(false)}
          user={user}
        />
      )}
      {showPinModal && <PinManagementModal onClose={() => setShowPinModal(false)} />}
    </>
  );
}