import React from 'react';
import { ShoppingCart, Package, FolderTree, Users, History, LogOut, User } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onLogout }) {
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
          <ShoppingCart size={18} /> POS Terminal
        </button>

        <button
          className={activeTab === 'products' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('products')}
        >
          <Package size={18} /> Products
        </button>

        <button
          className={activeTab === 'categories' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('categories')}
        >
          <FolderTree size={18} /> Categories
        </button>

        <button
          className={activeTab === 'customers' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('customers')}
        >
          <Users size={18} /> Customers
        </button>

        <button
          className={activeTab === 'sales' ? 'nav-item active' : 'nav-item'}
          onClick={() => setActiveTab('sales')}
        >
          <History size={18} /> Sales History
        </button>
      </div>

      <div className="nav-user">
        <div className="user-info">
          <User size={16} />
          <span>{user?.name}</span>
          <span className={`role-badge ${user?.role}`}>{user?.role}</span>
        </div>
        <button onClick={onLogout} className="logout-btn" title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}
