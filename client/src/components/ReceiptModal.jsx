import React from 'react';
import { Printer, CheckCircle, Store } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export default function ReceiptModal({
  sale,
  title = 'Receipt',
  isSuccess = false,
  cashierName = '',
  closeButtonText = 'Close',
  onClose
}) {
  const { currency, formatPrice } = useSettings();
  if (!sale) return null;

  const saleDate = sale.createdAt ? new Date(sale.createdAt) : null;
  const formattedDate = saleDate
    ? saleDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'N/A';
  const formattedTime = saleDate
    ? saleDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : 'N/A';

  const resolvedCashier = sale.cashier?.name || cashierName || 'Cashier';

  // Prefer the historical customer snapshot saved with the transaction
  const customerName =
    sale.customerSnapshot?.name ||
    sale.customer?.name ||
    'Walk-in Customer';

  const customerPhone =
    sale.customerSnapshot?.phone ||
    (sale.customer && !sale.customerSnapshot ? sale.customer.phone : null);

  const isWalkIn = customerName === 'Walk-in Customer' && !customerPhone;

  return (
    <div className="modal-backdrop">
      <div className="receipt-modal printable-receipt" id="printable-receipt">
        {isSuccess && (
          <div className="receipt-success-icon no-print">
            <CheckCircle size={44} color="#10b981" />
          </div>
        )}

        <div className="receipt-header">
          <div className="receipt-store-branding">
            <Store size={22} color="#4f46e5" className="receipt-store-icon" />
            <h2 className="receipt-store-name">RetailPOS Pro</h2>
          </div>
          <p className="receipt-store-tagline">Retail Point of Sale & Inventory</p>
          <div className="receipt-badge-title">{title}</div>
          <p className="invoice-num">Invoice #: {sale.invoiceNumber}</p>
        </div>

        <div className="receipt-details">
          <div className="receipt-meta-grid">
            <div className="receipt-row">
              <span className="receipt-label">Date:</span>
              <span className="receipt-value">{formattedDate}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Time:</span>
              <span className="receipt-value">{formattedTime}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Cashier:</span>
              <span className="receipt-value">{resolvedCashier}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">Customer:</span>
              <span className="receipt-value">{customerName}</span>
            </div>
            {!isWalkIn && customerPhone && (
              <div className="receipt-row">
                <span className="receipt-label">Phone:</span>
                <span className="receipt-value">{customerPhone}</span>
              </div>
            )}
            <div className="receipt-row">
              <span className="receipt-label">Payment:</span>
              <span className="receipt-value uppercase">{sale.paymentMethod || 'cash'}</span>
            </div>
          </div>

          <div className="receipt-divider"></div>

          {/* Line items with product, quantity, unit price, and line total */}
          <div className="receipt-items-container">
            <div className="receipt-items-header">
              <span>Item & Qty</span>
              <span>Total</span>
            </div>

            {sale.items && sale.items.map((item, idx) => {
              const qty = Number(item.quantity) || 1;
              const unitPrice = Number(item.price) || 0;
              const lineTotal = qty * unitPrice;

              return (
                <div key={idx} className="receipt-item-row">
                  <div className="receipt-item-left">
                    <span className="receipt-item-name">
                      {item.name} {item.sku ? `(${item.sku})` : ''}
                    </span>
                    <span className="receipt-item-breakdown">
                      {qty} × ₨ {unitPrice.toFixed(2)}
                    </span>
                  </div>
                  <span className="receipt-item-total">
                    ₨ {lineTotal.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="receipt-divider"></div>

          {/* Financial summary: subtotal, discount, tax, final total (ALWAYS in PKR) */}
          <div className="receipt-summary">
            <div className="receipt-row">
              <span>Subtotal:</span>
              <span>₨ {Number(sale.subtotal || 0).toFixed(2)}</span>
            </div>

            {Number(sale.discount || 0) > 0 && (
              <div className="receipt-row receipt-discount">
                <span>Discount:</span>
                <span>-₨ {Number(sale.discount).toFixed(2)}</span>
              </div>
            )}

            <div className="receipt-row">
              <span>Tax (5%):</span>
              <span>₨ {Number(sale.tax || 0).toFixed(2)}</span>
            </div>

            <div className="receipt-divider"></div>

            <div className="receipt-row receipt-total">
              <span>TOTAL (PKR):</span>
              <span>₨ {Number(sale.total || 0).toFixed(2)}</span>
            </div>

            {/* Display currency equivalent if non-PKR currency is active */}
            {currency !== 'PKR' && (
              <div className="receipt-row receipt-equiv-row" style={{ fontSize: '11px', color: '#6366f1' }}>
                <span>Display Equivalent ({currency}):</span>
                <span>{formatPrice(sale.total)}</span>
              </div>
            )}

            {/* Card Payment Simulation Details */}
            {sale.paymentMethod === 'card' && sale.paymentDetails && (
              <div className="receipt-card-details" style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '6px 8px', borderRadius: '4px' }}>
                <div><strong>Card:</strong> {sale.paymentDetails.cardType} (Ending in {sale.paymentDetails.last4})</div>
                <div><strong>Cardholder:</strong> {sale.paymentDetails.cardholderName}</div>
                <div><strong>Auth Ref:</strong> {sale.paymentDetails.transactionRef}</div>
              </div>
            )}
          </div>

          <div className="receipt-footer-notes">
            <p className="thank-you-text">Thank you for your business!</p>
            <p className="terms-text">Please keep this receipt for warranty and returns.</p>
          </div>
        </div>

        {/* Action buttons (hidden when printing) */}
        <div className="receipt-actions no-print">
          <button
            type="button"
            className="btn-secondary print-action-btn"
            onClick={() => window.print()}
          >
            <Printer size={16} /> Print Receipt
          </button>
          <button
            type="button"
            className="btn-primary close-action-btn"
            onClick={onClose}
          >
            {closeButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
