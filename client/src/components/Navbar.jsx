import React from 'react';
import { ShoppingCart, Package, FolderTree, Users, History, LogOut, User, Sun, Moon, Globe, DollarSign } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function Navbar({ activeTab, setActiveTab, user, onLogout }) {
  const { theme, toggleTheme, language, setLanguage, currency, setCurrency, availableCurrencies, t } = useSettings();

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <ShoppingCart size={24} color="#6366f1" />
        <span>RetailPOS</span>
      </div>

      <div className="nav-links">
        <button
          className={activeTab === 'pos' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('pos')}
        >
          <ShoppingCart size={18} /> {t('pos_terminal')}
        </button>

        <button
          className={activeTab === 'products' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('products')}
        >
          <Package size={18} /> {t('products')}
        </button>

        <button
          className={activeTab === 'categories' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('categories')}
        >
          <FolderTree size={18} /> {t('categories')}
        </button>

        <button
          className={activeTab === 'customers' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('customers')}
        >
          <Users size={18} /> {t('customers')}
        </button>

        <button
          className={activeTab === 'sales' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('sales')}
        >
          <History size={18} /> {t('sales_history')}
        </button>
      </div>

      <div className="nav-controls">
        {/* Currency Selector */}
        <div className="nav-setting-select" title="Display Currency">
          <DollarSign size={15} />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="header-select"
            aria-label="Display Currency"
          >
            {availableCurrencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} ({c.symbol})
              </option>
            ))}
          </select>
        </div>

        {/* Language Selector */}
        <div className="nav-setting-select" title="Interface Language">
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

        {/* Dark / Light Mode Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="theme-toggle-btn"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* User Info & Logout */}
        <div className="nav-user">
          <div className="user-info">
            <User size={16} />
            <span>{user?.name}</span>
            <span className={`role-badge ${user?.role}`}>{user?.role}</span>
          </div>
          <button onClick={onLogout} className="logout-btn" title={t('logout')}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}
