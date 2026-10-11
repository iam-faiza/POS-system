import React from 'react';
import { Printer, CheckCircle, Store } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import AccessibleDialog from './AccessibleDialog';

export default function ReceiptModal({
  sale,
  title = 'Receipt',
  isSuccess = false,
  cashierName = '',
  closeButtonText = 'Close',
  onClose
}) {
  const { formatPrice, t } = useSettings();
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
  const maskedCustomerPhone = customerPhone
    ? String(customerPhone).replace(/\d(?=\d{4})/g, '•')
    : null;
  const receiptTaxRate = Number.isFinite(sale.taxRate) ? sale.taxRate : 5;

  return (
    <AccessibleDialog className="receipt-modal printable-receipt" labelledBy="receipt-dialog-title" onClose={onClose}>
        {isSuccess && (
          <div className="receipt-success-icon no-print">
            <CheckCircle size={44} className="receipt-success-icon-mark" />
          </div>
        )}

        <div className="receipt-header">
          <div className="receipt-store-branding">
            <Store size={22} className="receipt-store-icon" />
            <h2 className="receipt-store-name">RetailPOS Pro</h2>
          </div>
          <p className="receipt-store-tagline">Retail Point of Sale & Inventory</p>
          <div className="receipt-badge-title" id="receipt-dialog-title">{title}</div>
          <p className="invoice-num">{t('invoice_num')}: {sale.invoiceNumber}</p>
        </div>

        <div className="receipt-details">
          <div className="receipt-meta-grid">
            <div className="receipt-row">
              <span className="receipt-label">{t('date')}:</span>
              <span className="receipt-value">{formattedDate}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">{t('time')}:</span>
              <span className="receipt-value">{formattedTime}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">{t('cashier')}:</span>
              <span className="receipt-value">{resolvedCashier}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">{t('customer_select')}:</span>
              <span className="receipt-value">{customerName}{maskedCustomerPhone ? ` (${maskedCustomerPhone})` : ''}</span>
            </div>
            <div className="receipt-row">
              <span className="receipt-label">{t('payment_method')}:</span>
              <span className="receipt-value uppercase">{sale.paymentMethod || 'cash'}</span>
            </div>
          </div>

          <div className="receipt-divider"></div>

          {/* Line items with product, quantity, unit price, and line total */}
          <div className="receipt-items-container">
            <div className="receipt-items-header">
              <span>{t('item_and_quantity')}</span>
              <span>{t('total_due')}</span>
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
                      {qty} × {formatPrice(unitPrice)}
                    </span>
                  </div>
                  <span className="receipt-item-total">
                    {formatPrice(lineTotal)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="receipt-divider"></div>

          {/* Financial summary: subtotal, discount, tax, final total (ALWAYS in PKR) */}
          <div className="receipt-summary">
            <div className="receipt-row">
              <span>{t('subtotal')}:</span>
              <span>{formatPrice(Number(sale.subtotal || 0))}</span>
            </div>

            {Number(sale.discount || 0) > 0 && (
              <div className="receipt-row receipt-discount">
                <span>{t('discount')}:</span>
                <span>-{formatPrice(Number(sale.discount))}</span>
              </div>
            )}

            <div className="receipt-row">
              <span>{t('tax')} ({receiptTaxRate}%):</span>
              <span>{formatPrice(Number(sale.tax || 0))}</span>
            </div>

            {sale.paymentMethod === 'cash' && Number.isFinite(sale.cashReceived) && (
              <>
                <div className="receipt-row">
                  <span>{t('cash_received')}:</span>
                  <span>{formatPrice(sale.cashReceived)}</span>
                </div>
                <div className="receipt-row">
                  <span>{t('change_due')}:</span>
                  <span>{formatPrice(Number(sale.changeDue || 0))}</span>
                </div>
              </>
            )}

            <div className="receipt-divider"></div>

            <div className="receipt-row receipt-total">
              <span>{t('total_due')} (PKR):</span>
              <span>{formatPrice(Number(sale.total || 0))}</span>
            </div>

            {/* Display currency equivalent if non-PKR currency is active */}
            {/* Card Payment Simulation Details (PRIVACY APPLIED) */}
            {sale.paymentMethod === 'card' && sale.paymentDetails && (
              <div className="receipt-card-details">
                <div><strong>{t('receipt_card_type')}:</strong> {sale.paymentDetails.cardType}</div>
              </div>
            )}
          </div>

          <div className="receipt-footer-notes">
            <p className="thank-you-text">{t('thank_you')}</p>
            <p className="terms-text">{t('receipt_keep_note')}</p>
          </div>
        </div>

        {/* Action buttons (hidden when printing) */}
        <div className="receipt-actions no-print">
          <button
            type="button"
            className="btn-secondary print-action-btn"
            onClick={() => window.print()}
          >
            <Printer size={16} /> {t('print_receipt')}
          </button>
          <button
            type="button"
            className="btn-primary close-action-btn"
            onClick={onClose}
          >
            {closeButtonText}
          </button>
        </div>
    </AccessibleDialog>
  );
}
