import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import { useSettings } from '../context/SettingsContext';

export default function SalesHistory() {
  const { t, formatPrice } = useSettings();
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [preset, setPreset] = useState('all');
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const needsDateInput = (preset === 'date' && !date) || (preset === 'range' && (!startDate || !endDate));

  useEffect(() => {
    if (needsDateInput) return undefined;
    const controller = new AbortController();
    const loadSales = async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: '25' });
        if (preset !== 'all') params.set('preset', preset);
        if (preset === 'date') params.set('date', date);
        if (preset === 'range') {
          params.set('startDate', startDate);
          params.set('endDate', endDate);
        }
        const response = await API.get(`/sales?${params.toString()}`, { signal: controller.signal });
        setSales(response.data);
        setTotalPages(Math.max(1, Number(response.headers['x-total-pages']) || 1));
        setTotalCount(Number(response.headers['x-total-count']) || 0);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.response?.data?.message || 'failed_load_sales');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadSales();
    return () => controller.abort();
  }, [preset, date, startDate, endDate, page, needsDateInput]);

  const changePreset = (value) => {
    setError('');
    setLoading(value !== 'date' && value !== 'range');
    setPreset(value);
    setPage(1);
  };

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>{t('sales_history')}</h2>
        <div className="sales-filter-controls">
          <label htmlFor="sales-date-filter">{t('filter_date')}</label>
          <select id="sales-date-filter" value={preset} onChange={(event) => changePreset(event.target.value)}>
            <option value="all">{t('filter_all')}</option>
            <option value="today">{t('filter_today')}</option>
            <option value="yesterday">{t('filter_yesterday')}</option>
            <option value="date">{t('filter_specific_date')}</option>
            <option value="range">{t('filter_date_range')}</option>
            <option value="week">{t('filter_this_week')}</option>
            <option value="month">{t('filter_this_month')}</option>
            <option value="year">{t('filter_this_year')}</option>
          </select>
          {preset === 'date' && (
            <input aria-label={t('filter_specific_date')} type="date" value={date} onChange={(event) => { setError(''); setLoading(Boolean(event.target.value)); setPage(1); setDate(event.target.value); }} />
          )}
          {preset === 'range' && (
            <div className="sales-date-range">
              <label htmlFor="sales-start-date">{t('start_date')}</label>
              <input id="sales-start-date" type="date" value={startDate} onChange={(event) => { setError(''); setLoading(Boolean(event.target.value && endDate)); setPage(1); setStartDate(event.target.value); }} />
              <label htmlFor="sales-end-date">{t('end_date')}</label>
              <input id="sales-end-date" type="date" value={endDate} onChange={(event) => { setError(''); setLoading(Boolean(startDate && event.target.value)); setPage(1); setEndDate(event.target.value); }} />
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-alert" role="alert">{error === 'failed_load_sales' ? t(error) : error}</div>}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('invoice_num')}</th>
              <th>{t('cashier')}</th>
              <th>{t('customer_select')}</th>
              <th>{t('items')}</th>
              <th>{t('total_due')}</th>
              <th>{t('payment_method')}</th>
              <th>{t('date')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!needsDateInput && sales.map((s) => (
              <tr key={s._id}>
                <td><code>{s.invoiceNumber}</code></td>
                <td>{s.cashier?.name || 'N/A'}</td>
                <td>{s.customerSnapshot?.name || s.customer?.name || 'Walk-in'}</td>
                <td>{s.items.reduce((acc, item) => acc + item.quantity, 0)} {t('sales_items_count')}</td>
                <td><strong>{formatPrice(s.total)}</strong></td>
                <td><span className="uppercase badge">{s.paymentMethod}</span></td>
                <td>{new Date(s.createdAt).toLocaleString()}</td>
                <td>
                  <button className="icon-btn" onClick={() => setSelectedSale(s)} title={t('invoice_details')} aria-label={`${t('invoice_details')}: ${s.invoiceNumber}`}>
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {(needsDateInput || sales.length === 0) && !loading && (
              <tr>
                <td colSpan="8" className="text-center">{needsDateInput ? t('select_date_to_filter') : t('no_sales')}</td>
              </tr>
            )}
            {loading && <tr><td colSpan="8" className="text-center">{t('loading')}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="sales-pagination" aria-label={t('pagination')}>
        <span>{needsDateInput ? 0 : totalCount} {t('sales_count')} · {t('page')} {needsDateInput ? 1 : page} / {needsDateInput ? 1 : totalPages}</span>
        <button type="button" className="icon-btn" aria-label={t('previous_page')} disabled={page <= 1 || loading} onClick={() => { setError(''); setLoading(true); setPage((current) => Math.max(1, current - 1)); }}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label={t('next_page')} disabled={page >= totalPages || loading} onClick={() => { setError(''); setLoading(true); setPage((current) => Math.min(totalPages, current + 1)); }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {selectedSale && (
        <ReceiptModal
          sale={selectedSale}
          title={t('invoice_details')}
          isSuccess={false}
          cashierName={selectedSale.cashier?.name}
          closeButtonText={t('close')}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
}
