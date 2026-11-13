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
import Reports from './components/Reports';
import LockScreen from './components/LockScreen';
import API from './services/api';
import { hasFeatureAccess } from './utils/featureAccess';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [permissionRegistry, setPermissionRegistry] = useState(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lockStatus, setLockStatus] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const userId = String(user._id || user.id || '');
    API.get('/auth/lock/status')
      .then(({ data }) => setLockStatus({ userId, locked: Boolean(data.locked) }))
      .catch(() => setLockStatus({ userId, locked: true }));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    API.get('/roles/permissions')
      .then(({ data }) => setPermissionRegistry(Array.isArray(data) ? data : []))
      .catch(() => setPermissionRegistry([]));
  }, [user]);

  useEffect(() => {
    const onAuthExpired = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setLockStatus(null);
    };
    window.addEventListener('authExpired', onAuthExpired);
    return () => window.removeEventListener('authExpired', onAuthExpired);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setLockStatus(null);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const currentUserId = String(user._id || user.id || '');
  const isLocked = lockStatus?.userId !== currentUserId || lockStatus?.locked !== false;

  return (
    <div className="app-layout">
      {isLocked && <LockScreen user={user} onUnlock={() => setLockStatus({ userId: currentUserId, locked: false })} />}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        permissionRegistry={permissionRegistry || []}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      <div className="app-main">
        <Navbar 
          user={user} 
          onLogout={handleLogout} 
          onLock={() => setLockStatus({ userId: currentUserId, locked: true })}
          isSidebarCollapsed={isSidebarCollapsed} 
        />
        <main className="main-content">
          {permissionRegistry === null ? (
            <p role="status">Checking access...</p>
          ) : !hasFeatureAccess(user, permissionRegistry, activeTab) ? (
            <p role="alert">Access denied.</p>
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard />}
              {activeTab === 'pos' && <PosTerminal user={user} />}
              {activeTab === 'products' && <ProductsManager user={user} />}
              {activeTab === 'categories' && <CategoriesManager user={user} />}
              {activeTab === 'customers' && <CustomersManager user={user} />}
              {activeTab === 'sales' && <SalesHistory user={user} />}
              {activeTab === 'roles' && <RolesManager user={user} />}
              {activeTab === 'employees' && <EmployeesManager user={user} />}
              {activeTab === 'reports' && <Reports />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}