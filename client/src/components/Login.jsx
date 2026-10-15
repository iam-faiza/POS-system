import React, { useState } from 'react';
import API from '../services/api';
import { Lock, Mail, Store, Eye, EyeOff } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function Login({ onLogin }) {
  const { t } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpeningGates, setIsOpeningGates] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email: email.trim(), password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data));
      
      // Trigger smooth gate opening animation
      setIsOpeningGates(true);

      setTimeout(() => {
        onLogin(res.data);
      }, 900); // Matches CSS slide transition duration
    } catch {
      setError(t('invalid_credentials'));
      setLoading(false);
    }
  };

  return (
    <div className={`login-gate-container ${isOpeningGates ? 'opening' : ''}`}>
      {/* Left Gate Panel (Form Section) */}
      <div className="gate-panel left-gate">
        <div className="login-form-box">
          <div className="login-header" style={{ textAlign: 'left', marginBottom: '20px' }}>
            <div className="login-icon-wrap" style={{ margin: '0 0 12px 0' }}>
              <Store size={32} aria-hidden="true" />
            </div>
            <h1>{t('login_title')}</h1>
            <p>{t('login_subtitle')}</p>
          </div>

          {error && <div className="error-alert" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email"><Mail size={16} /> {t('email_address')}</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password"><Lock size={16} /> {t('password')}</label>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('hide_password') : t('show_password')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
              {loading ? t('signing_in') : t('sign_in')}
            </button>
          </form>
        </div>
      </div>

      {/* Right Gate Panel (Vector Illustration Section) */}
      <div className="gate-panel right-gate">
        <div className="login-illustration-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
          <svg width="340" height="260" viewBox="0 0 340 260" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M70 150C70 100 130 110 160 80C190 50 260 60 280 110C300 160 320 210 260 230C200 250 70 200 70 150Z" fill="rgba(136, 14, 79, 0.08)"/>
            <rect x="30" y="195" width="280" height="16" rx="6" fill="#880E4F" />
            <rect x="50" y="211" width="240" height="30" rx="4" fill="#FCE4EC" />
            <rect x="190" y="160" width="60" height="35" rx="6" fill="#4B5563" />
            <rect x="198" y="166" width="44" height="23" rx="3" fill="#F472B6" />
            <rect x="210" y="195" width="20" height="15" fill="#374151" />
            <circle cx="260" cy="115" r="26" fill="#FFEDD5" />
            <path d="M242 105C245 90 265 85 278 95C285 100 282 115 275 120C265 125 240 120 242 105Z" fill="#1F2937" />
            <path d="M220 135L250 135C270 135 290 150 295 195H220V135Z" fill="#880E4F" />
            <rect x="235" y="125" width="45" height="15" rx="4" fill="#FFFFFF" />
            <path d="M160 175H195V183H160C155 183 150 179 150 179C150 179 155 175 160 175Z" fill="#FFEDD5" />
          </svg>
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
              Retail Point of Sale & Inventory
            </h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              Manage transactions, real-time stock, and Z-reports efficiently.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}