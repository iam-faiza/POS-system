import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { BarChart } from './SvgCharts';
import { AlertTriangle, TrendingUp } from 'lucide-react';

const PERIODS = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['week', 'This week'],
  ['month', 'This month'],
  ['year', 'This year'],
  ['all', 'All time']
];

function RankedBars({ rows, labelKey, valueKey, format, emptyText }) {
  if (rows.length === 0) return <p className="muted">{emptyText}</p>;
  const max = Math.max(...rows.map((row) => row[valueKey]), 0) || 1;
  return (
    <ul className="ranked-list">
      {rows.map((row, index) => (
        <li key={`${row[labelKey]}-${index}`}>
          <div className="ranked-head">
            <span>{row[labelKey]}</span>
            <strong>{format(row[valueKey])}</strong>
          </div>
          <div className="ranked-track">
            <div className="ranked-fill" style={{ transform: `scaleX(${row[valueKey] / max})` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Reports() {
  const { formatPrice } = useSettings();
  const [preset, setPreset] = useState('today');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    API.get(`/reports/profit?preset=${preset}`, { signal: controller.signal })
      .then((response) => {
        setReport(response.data);
        setError('');
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError.response?.data?.message || 'Unable to load the report');
        }
      });
    return () => controller.abort();
  }, [preset]);

  const money = (value) => formatPrice(value || 0);
  const summary = report?.summary;
  const isStale = report && report.preset !== preset;

  return (
    <section className="manager-container reports-container" aria-labelledby="reports-title">
      <header className="manager-header">
        <h2 id="reports-title">Sales &amp; profit</h2>
        <div className="toolbar">
          <div className="search-box select-box">
            <TrendingUp size={16} aria-hidden="true" />
            <select aria-label="Report period" value={preset} onChange={(event) => setPreset(event.target.value)}>
              {PERIODS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {error && <div className="error-alert" role="alert">{error}</div>}
      {!report && !error && <p role="status">Loading report…</p>}

      {report && summary && (
        <div className={isStale ? 'is-stale' : ''}>
          {summary.itemsWithoutCost > 0 && (
            <div className="warning-alert" role="note">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>
                {summary.itemsWithoutCost} item(s) in {summary.salesWithoutCost} sale(s) have no cost price,
                so they are left out of profit. Add cost prices in Products to include them.
              </span>
            </div>
          )}

          <div className="dashboard-metrics reports-metrics">
            <section className="dashboard-metric">
              <h3>Revenue</h3>
              <strong>{money(summary.revenue)}</strong>
              <small className="muted">{summary.salesCount} sale(s)</small>
            </section>
            <section className="dashboard-metric">
              <h3>Gross profit</h3>
              <strong>{money(summary.grossProfit)}</strong>
              <small className="muted">Before discounts</small>
            </section>
            <section className="dashboard-metric">
              <h3>Margin</h3>
              <strong>{summary.marginPercent == null ? '—' : `${summary.marginPercent.toFixed(1)}%`}</strong>
              <small className="muted">On items with a cost</small>
            </section>
            <section className="dashboard-metric">
              <h3>Net profit</h3>
              <strong>{money(summary.netProfit)}</strong>
              <small className="muted">After {money(summary.discounts)} discounts</small>
            </section>
          </div>

          <div className="reports-grid">
            <section className="report-card report-wide">
              <div className="report-card-head">
                <h3>Revenue and profit by day</h3>
                <span className="report-legend">
                  <i className="legend-dot legend-primary" /> Revenue
                  <i className="legend-dot legend-secondary" /> Gross profit
                </span>
              </div>
              <BarChart
                items={report.byDay}
                labelKey="day"
                valueKey="revenue"
                secondaryKey="grossProfit"
                format={money}
                labelFormat={(day) => day.slice(5)}
                labelEvery={Math.ceil(report.byDay.length / 10) || 1}
                height={220}
                ariaLabel="Revenue and gross profit by day"
              />
            </section>

            <section className="report-card">
              <h3>Sales by hour</h3>
              <BarChart
                items={report.byHour}
                labelKey="hour"
                valueKey="revenue"
                format={money}
                labelFormat={(hour) => `${hour}`}
                labelEvery={3}
                height={220}
                width={330}
                ariaLabel="Revenue by hour of day"
              />
            </section>

            <section className="report-card report-wide">
              <h3>Top products</h3>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Revenue</th>
                      <th>Gross profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topProducts.length === 0 && (
                      <tr><td colSpan={4} className="empty-cell">No sales in this period</td></tr>
                    )}
                    {report.topProducts.map((product) => (
                      <tr key={product.productId}>
                        <td>
                          <strong>{product.name}</strong> <code>{product.sku}</code>
                          {product.unknownLines > 0 && <span className="badge warning badge-inline">no cost</span>}
                        </td>
                        <td>{product.quantity}</td>
                        <td>{money(product.revenue)}</td>
                        <td>{product.unknownLines > 0 && product.grossProfit === 0 ? '—' : money(product.grossProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="report-card">
              <h3>Categories</h3>
              <RankedBars rows={report.byCategory} labelKey="name" valueKey="revenue" format={money} emptyText="No sales in this period" />
            </section>

            <section className="report-card">
              <h3>Cashiers</h3>
              <RankedBars rows={report.byCashier} labelKey="name" valueKey="revenue" format={money} emptyText="No sales in this period" />
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
