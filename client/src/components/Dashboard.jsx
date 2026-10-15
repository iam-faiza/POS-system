import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { AlertTriangle, DollarSign, ShoppingBag } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function Dashboard() {
  const { t, formatPrice } = useSettings();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const showStockAlerts = Array.isArray(summary?.lowStockProducts);

  // Reload the numbers on mount, after every sale or shift change, and every 30 seconds.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    API.get('/sales/summary', { signal: controller.signal })
      .then((response) => {
        setSummary(response.data);
        setError('');
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError.response?.data?.message || 'Failed to load dashboard summary');
        }
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const refresh = () => setReloadKey((key) => key + 1);
    const timer = setInterval(refresh, 30000);
    window.addEventListener('saleCompleted', refresh);
    window.addEventListener('shiftUpdated', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('saleCompleted', refresh);
      window.removeEventListener('shiftUpdated', refresh);
    };
  }, []);

  return (
    <section className="manager-container dashboard-container" aria-labelledby="dashboard-title">
      <header className="manager-header">
        <h2 id="dashboard-title">{t('dashboard')}</h2>
      </header>
      {error && <div className="error-alert" role="alert">{error}</div>}
      {!summary && !error && <p role="status">{t('loading')}</p>}
      {summary && (
        <>
          <div className="dashboard-metrics">
            <section className="dashboard-metric">
              <ShoppingBag aria-hidden="true" />
              <h3>{t('sales_today')}</h3>
              <strong>{summary.salesToday}</strong>
            </section>
            <section className="dashboard-metric">
              <DollarSign aria-hidden="true" />
              <h3>{t('revenue_today')}</h3>
              <strong>{formatPrice(summary.revenueToday)}</strong>
            </section>
            {showStockAlerts && (
              <section className="dashboard-metric dashboard-low-stock">
                <AlertTriangle aria-hidden="true" />
                <h3>{t('low_stock_alerts')}</h3>
                <strong>{summary.lowStockCount}</strong>
              </section>
            )}
          </div>
          {showStockAlerts && (
          <section className="dashboard-low-stock-list" aria-labelledby="low-stock-title">
            <h3 id="low-stock-title">{t('low_stock_alerts')}</h3>
            {summary.lowStockProducts.length === 0 ? (
              <p>{t('no_low_stock')}</p>
            ) : (
              <ul>
                {summary.lowStockProducts.map((product) => (
                  <li key={product._id}>
                    <span>{product.name} <code>{product.sku}</code></span>
                    <span>{t('stock')}: {product.stockQuantity} / {t('threshold')}: {product.lowStockThreshold}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          )}
        </>
      )}
    </section>
  );
}