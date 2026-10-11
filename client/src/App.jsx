import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Navbar from './components/Navbar';
import PosTerminal from './components/PosTerminal';
import ProductsManager from './components/ProductsManager';
import CategoriesManager from './components/CategoriesManager';
import CustomersManager from './components/CustomersManager';
import SalesHistory from './components/SalesHistory';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pos');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {activeTab === 'pos' && <PosTerminal user={user} />}
        {activeTab === 'products' && <ProductsManager user={user} />}
        {activeTab === 'categories' && <CategoriesManager user={user} />}
        {activeTab === 'customers' && <CustomersManager user={user} />}
        {activeTab === 'sales' && <SalesHistory user={user} />}
      </main>
    </div>
  );
}
