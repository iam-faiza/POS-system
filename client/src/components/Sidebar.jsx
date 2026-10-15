import React from 'react';
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Package, 
  FolderTree, 
  Users, 
  Shield, 
  History, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { isAdminUser } from '../utils/roles';

export default function Sidebar({ activeTab, setActiveTab, user, isCollapsed, setIsCollapsed }) {
  const { t } = useSettings();
  const isAdmin = isAdminUser(user);

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        {!isCollapsed && (
          <div className="brand-logo">
            <ShoppingCart size={22} className="brand-icon" />
            <span className="brand-title">RetailPOS</span>
          </div>
        )}
        <button 
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="sidebar-toggle-btn" 
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {(isAdmin || user?.permissions?.includes('dashboard.view_own') || user?.permissions?.includes('dashboard.view_team')) && (
          <button
            type="button"
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            title={isCollapsed ? t('dashboard') : ''}
          >
            <LayoutDashboard size={20} />
            {!isCollapsed && <span>{t('dashboard')}</span>}
          </button>
        )}

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'pos' ? 'active' : ''}`}
          onClick={() => setActiveTab('pos')}
          title={isCollapsed ? t('pos_terminal') : ''}
        >
          <ShoppingCart size={20} />
          {!isCollapsed && <span>{t('pos_terminal')}</span>}
        </button>

        {(isAdmin || user?.permissions?.includes('products.view') || user?.permissions?.includes('products.manage')) && (
          <button
            type="button"
            className={`sidebar-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
            title={isCollapsed ? t('products') : ''}
          >
            <Package size={20} />
            {!isCollapsed && <span>{t('products')}</span>}
          </button>
        )}

        {(isAdmin || user?.permissions?.includes('products.view') || user?.permissions?.includes('products.manage')) && (
          <button
            type="button"
            className={`sidebar-item ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
            title={isCollapsed ? t('categories') : ''}
          >
            <FolderTree size={20} />
            {!isCollapsed && <span>{t('categories')}</span>}
          </button>
        )}

        {(isAdmin || user?.permissions?.includes('customers.view')) && (
          <button
            type="button"
            className={`sidebar-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
            title={isCollapsed ? t('customers') : ''}
          >
            <Users size={20} />
            {!isCollapsed && <span>{t('customers')}</span>}
          </button>
        )}

        {(isAdmin || user?.permissions?.includes('roles.manage')) && (
          <button
            type="button"
            className={`sidebar-item ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
            title={isCollapsed ? t('roles') : ''}
          >
            <Shield size={20} />
            {!isCollapsed && <span>{t('roles')}</span>}
          </button>
        )}

        {(isAdmin || user?.permissions?.includes('employees.manage')) && (
          <button
            type="button"
            className={`sidebar-item ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
            title={isCollapsed ? t('employees') : ''}
          >
            <Users size={20} />
            {!isCollapsed && <span>{t('employees')}</span>}
          </button>
        )}

        {(isAdmin || user?.permissions?.includes('sales.view_own') || user?.permissions?.includes('sales.view_all')) && (
          <button
            type="button"
            className={`sidebar-item ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
            title={isCollapsed ? t('sales_history') : ''}
          >
            <History size={20} />
            {!isCollapsed && <span>{t('sales_history')}</span>}
          </button>
        )}
      </nav>
    </aside>
  );
}