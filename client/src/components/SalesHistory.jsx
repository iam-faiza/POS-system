import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Eye } from 'lucide-react';
import ReceiptModal from './ReceiptModal';

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const res = await API.get('/sales');
      setSales(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>Sales History</h2>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Cashier</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s._id}>
                <td><code>{s.invoiceNumber}</code></td>
                <td>{s.cashier?.name || 'N/A'}</td>
                <td>{s.customerSnapshot?.name || s.customer?.name || 'Walk-in'}</td>
                <td>{s.items.reduce((acc, item) => acc + item.quantity, 0)} items</td>
                <td><strong>${s.total.toFixed(2)}</strong></td>
                <td><span className="uppercase badge">{s.paymentMethod}</span></td>
                <td>{new Date(s.createdAt).toLocaleString()}</td>
                <td>
                  <button className="icon-btn" onClick={() => setSelectedSale(s)} title="View Details">
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center">No sales recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedSale && (
        <ReceiptModal
          sale={selectedSale}
          title="Invoice Details"
          isSuccess={false}
          cashierName={selectedSale.cashier?.name}
          closeButtonText="Close"
          onClose={() => setSelectedSale(null)}
        />
      )}
    </div>
  );
}
