import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Eye, Printer } from 'lucide-react';

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
                <td>{s.customer?.name || 'Walk-in'}</td>
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
        <div className="modal-backdrop">
          <div className="receipt-modal">
            <h2>Invoice Details</h2>
            <p className="invoice-num">{selectedSale.invoiceNumber}</p>

            <div className="receipt-details">
              <div className="receipt-row">
                <span>Date:</span>
                <span>{new Date(selectedSale.createdAt).toLocaleString()}</span>
              </div>
              <div className="receipt-row">
                <span>Cashier:</span>
                <span>{selectedSale.cashier?.name}</span>
              </div>
              <div className="receipt-row">
                <span>Customer:</span>
                <span>{selectedSale.customer?.name || 'Walk-in Customer'}</span>
              </div>
              <div className="receipt-row">
                <span>Payment Method:</span>
                <span className="uppercase">{selectedSale.paymentMethod}</span>
              </div>
              <div className="receipt-divider"></div>
              {selectedSale.items.map((i, idx) => (
                <div key={idx} className="receipt-item-row">
                  <span>{i.name} ({i.sku}) x {i.quantity}</span>
                  <span>${(i.price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="receipt-divider"></div>
              <div className="receipt-row">
                <span>Subtotal:</span>
                <span>${selectedSale.subtotal.toFixed(2)}</span>
              </div>
              <div className="receipt-row">
                <span>Tax:</span>
                <span>${selectedSale.tax.toFixed(2)}</span>
              </div>
              <div className="receipt-row">
                <span>Discount:</span>
                <span>${selectedSale.discount.toFixed(2)}</span>
              </div>
              <div className="receipt-row receipt-total">
                <span>Total:</span>
                <span>${selectedSale.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="receipt-actions">
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> Print
              </button>
              <button className="btn-primary" onClick={() => setSelectedSale(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
