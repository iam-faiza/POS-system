import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import PosTerminal from './components/PosTerminal';
import ProductsManager from './components/ProductsManager';
import CategoriesManager from './components/CategoriesManager';
import CustomersManager from './components/CustomersManager';
import SalesHistory from './components/SalesHistory';
import Dashboard from './components/Dashboard';
import RolesManager from './components/RolesManager';
import EmployeesManager from './components/EmployeesManager';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    <div className="app-layout">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      <div className="app-main">
        <Navbar 
          user={user} 
          onLogout={handleLogout} 
          isSidebarCollapsed={isSidebarCollapsed} 
        />
        <main className="main-content">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'pos' && <PosTerminal user={user} />}
          {activeTab === 'products' && <ProductsManager user={user} />}
          {activeTab === 'categories' && <CategoriesManager user={user} />}
          {activeTab === 'customers' && <CustomersManager user={user} />}
          {activeTab === 'sales' && <SalesHistory user={user} />}
          {activeTab === 'roles' && <RolesManager user={user} />}
          {activeTab === 'employees' && <EmployeesManager user={user} />}
        </main>
      </div>
    </div>
  );
}