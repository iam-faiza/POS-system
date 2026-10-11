import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { AlertTriangle, DollarSign, ShoppingBag } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function Dashboard() {
  const { t, formatPrice } = useSettings();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get('/sales/summary')
      .then((response) => setSummary(response.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'failed_load_dashboard'));
  }, []);

  return (
    <section className="manager-container dashboard-container" aria-labelledby="dashboard-title">
      <header className="manager-header">
        <h2 id="dashboard-title">{t('dashboard')}</h2>
      </header>
      {error && <div className="error-alert" role="alert">{error === 'failed_load_dashboard' ? t(error) : error}</div>}
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
            <section className="dashboard-metric dashboard-low-stock">
              <AlertTriangle aria-hidden="true" />
              <h3>{t('low_stock_alerts')}</h3>
              <strong>{summary.lowStockCount}</strong>
            </section>
          </div>
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
        </>
      )}
    </section>
  );
}