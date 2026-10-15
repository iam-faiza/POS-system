import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';
import { Search, Plus, Minus, Trash2, CreditCard, DollarSign } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import { useSettings } from '../context/SettingsContext';
import { localizeCustomerValidationError, normalizePakistaniPhone, validateCustomerDetails } from '../utils/customerValidation';
import AccessibleDialog from './AccessibleDialog';

export default function PosTerminal({ user }) {
  const { t, formatPrice } = useSettings();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', email: '' });
  const [customerFormError, setCustomerFormError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cardType, setCardType] = useState('Visa');
  const [cashReceived, setCashReceived] = useState('');
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(5);
  const [completedSale, setCompletedSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const scanMessageTimeoutRef = useRef(null);
  const [scanMessage, setScanMessage] = useState('');

  const fetchShift = async () => {
    try {
      const shiftRes = await API.get('/shifts/current');
      setActiveShift(shiftRes.data?.activeShift || null);
    } catch (err) {
      setActiveShift(null);
    }
  };

  useEffect(() => {
    fetchData();
    fetchShift();
    searchInputRef.current?.focus();

    // Listen for real-time shift updates dispatched by Navbar / ShiftModal
    window.addEventListener('shiftUpdated', fetchShift);

    return () => {
      window.removeEventListener('shiftUpdated', fetchShift);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (scanMessageTimeoutRef.current) clearTimeout(scanMessageTimeoutRef.current);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, catRes, settingsRes] = await Promise.all([
        API.get('/products?activeOnly=true'),
        API.get('/categories'),
        API.get('/sales/settings')
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
      setTaxRate(settingsRes.data.taxRate);
    } catch (err) {
      console.error(err);
      setError(t('failed_load_pos'));
    }
  };

  const handleCustomerSearch = async (query) => {
    setCustomerSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query || query.trim().length < 1) {
      setCustomers([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await API.get(`/customers?search=${encodeURIComponent(query)}`);
        setCustomers(res.data);
      } catch (err) {
        console.error('Search failed', err);
      }
    }, 300);
  };

  const addToCart = (product) => {
    if (product.stockQuantity <= 0) {
      alert(t('out_of_stock'));
      return;
    }
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product._id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          alert(t('max_stock_reached'));
          return prevCart;
        }
        return prevCart.map((item) =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            productId: product._id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            quantity: 1,
            maxStock: product.stockQuantity
          }
        ];
      }
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.maxStock) {
              alert(t('exceeds_stock'));
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Number(((subtotal * taxRate) / 100).toFixed(2));
  const discountAmount = Number(discount || 0);
  const total = Number((subtotal + tax - discountAmount).toFixed(2));

  const handleCheckout = async () => {
    if (!activeShift) {
      setError('Register shift is closed. Please open a shift from the top header before selling.');
      return;
    }
    if (cart.length === 0) return;
    setError('');

    setLoading(true);
    try {
      const saleData = {
        customer: selectedCustomer?._id || undefined,
        items: cart.map(({ productId, name, sku, quantity, price }) => ({
          productId,
          name,
          sku,
          quantity,
          price
        })),
        subtotal,
        tax,
        discount: discountAmount,
        total: total > 0 ? total : 0,
        paymentMethod,
        ...(paymentMethod === 'cash' && cashReceived !== '' && { cashReceived: Number(cashReceived) }),
        ...(paymentMethod === 'card' && { paymentDetails: { cardType } })
      };

      const res = await API.post('/sales', saleData);
      setCompletedSale(res.data);
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setCustomerSearchQuery('');
      setCashReceived('');
      setCardType('Visa');
      setPaymentMethod('cash');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || t('checkout_failed'));
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat =
      selectedCategory === 'all' ||
      p.category?._id === selectedCategory ||
      p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const showScanMessage = (message) => {
    setScanMessage(message);
    if (scanMessageTimeoutRef.current) clearTimeout(scanMessageTimeoutRef.current);
    scanMessageTimeoutRef.current = setTimeout(() => setScanMessage(''), 2500);
  };

  // Barcode scanners type the code and press Enter, so Enter on the search box adds the item.
  // An exact SKU match wins; otherwise a single remaining search result is added.
  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const code = searchQuery.trim().toLowerCase();
    if (!code) return;

    const exactMatch = products.find((p) => p.sku.toLowerCase() === code);
    const match = exactMatch || (filteredProducts.length === 1 ? filteredProducts[0] : null);

    if (match) {
      addToCart(match);
      setSearchQuery('');
      setScanMessage('');
    } else {
      showScanMessage(t('sku_not_found'));
    }
    searchInputRef.current?.focus();
  };

  // Suggest the next round amounts above the total (e.g. 230 -> 300, 500, 1000).
  const quickCashAmounts = total > 0
    ? [...new Set([100, 500, 1000, 5000].map((step) => Math.ceil(total / step) * step))]
        .filter((amount) => amount > total)
        .sort((a, b) => a - b)
        .slice(0, 3)
    : [];

  return (
    <div className="pos-container">
      {/* Product Catalog Section */}
      <div className="pos-catalog">
        <div className="catalog-header">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              aria-label={t('search_products')}
              placeholder={t('search_products')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              ref={searchInputRef}
            />
          </div>
          {scanMessage && <p className="scan-message" role="status">{scanMessage}</p>}
        </div>

        <div className="category-tabs">
          <button
            className={selectedCategory === 'all' ? 'cat-tab active' : 'cat-tab'}
            onClick={() => setSelectedCategory('all')}
          >
            {t('all_categories')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              className={selectedCategory === cat._id ? 'cat-tab active' : 'cat-tab'}
              onClick={() => setSelectedCategory(cat._id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="product-grid">
          {filteredProducts.map((p) => (
            <button
              type="button"
              key={p._id}
              className={`product-card ${p.stockQuantity <= 0 ? 'out-of-stock' : ''}`}
              aria-label={`${p.name}, SKU ${p.sku}, ${t('stock')} ${p.stockQuantity}, ${formatPrice(p.price)}`}
              onClick={() => addToCart(p)}
            >
              <div className="product-name">{p.name}</div>
              <div className="product-sku">SKU: {p.sku}</div>
              <div className="product-footer">
                <span className="product-price">{formatPrice(p.price)}</span>
                <span className={`stock-badge ${user?.role === 'admin' && p.stockQuantity <= p.lowStockThreshold ? 'low' : ''}`}>
                  {t('stock')}: {p.stockQuantity}
                </span>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="no-products">{t('no_products')}</div>
          )}
        </div>
      </div>

      {/* Cart & Checkout Panel */}
      <div className="pos-cart-panel">
        <div className="cart-header">
          <h3>{t('cart')}</h3>
          <span className="cart-count">{cart.reduce((s, i) => s + i.quantity, 0)} {t('items')}</span>
        </div>

        {error && <div className="error-alert">{error}</div>}

        {/* Customer Selection */}
        <div className="customer-select-area">
          <div className="customer-select-header">
            <label>{t('customer_select')}:</label>
            <button
              type="button"
              className="btn-link-sm"
              onClick={() => {
                setCustomerFormError('');
                setNewCustomerForm({ phone: '', name: '', email: '', marketingConsent: false });
                setShowNewCustomerModal(true);
              }}
            >
              <Plus size={14} /> {t('add_new_customer')}
            </button>
          </div>

          {selectedCustomer ? (
            <div className="selected-customer-card">
              <div className="selected-customer-info">
                <strong>{selectedCustomer.name}</strong>
                <span>{selectedCustomer.phone}</span>
              </div>
              <button
                type="button"
                className="btn-clear-customer"
                onClick={() => setSelectedCustomer(null)}
              >
                Change / Clear
              </button>
            </div>
          ) : (
            <div className="customer-search-wrapper">
              <div className="search-box customer-search-input-box">
                <Search size={16} />
                <input
                  type="text"
                  aria-label={t('search_customer_pos')}
                  placeholder={t('search_customer_pos')}
                  value={customerSearchQuery}
                  onChange={(e) => {
                    handleCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
              </div>
              {showCustomerDropdown && (
                <div className="customer-dropdown">
                  <button
                    type="button"
                    className="customer-dropdown-item walk-in"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearchQuery('');
                      setShowCustomerDropdown(false);
                    }}
                  >
                    <strong>{t('walk_in_customer')}</strong>
                    <span className="muted">{t('no_customer_assigned')}</span>
                  </button>
                  {customers.map((c) => (
                    <button
                      type="button"
                      key={c._id}
                      className="customer-dropdown-item"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerSearchQuery('');
                        setShowCustomerDropdown(false);
                      }}
                    >
                      <strong>{c.name}</strong>
                      <span>{c.phone}</span>
                    </button>
                  ))}
                  {customers.length === 0 && customerSearchQuery.trim().length > 0 && (
                    <div className="customer-dropdown-no-results">{t('customer_search_empty')}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="cart-items-list">
          {cart.map((item) => (
            <div key={item.productId} className="cart-item">
              <div className="cart-item-info">
                <span className="cart-item-name">{item.name}</span>
                <span className="cart-item-price">{formatPrice(item.price * item.quantity)}</span>
              </div>
              <div className="cart-item-actions">
                <button aria-label={t('decrease_quantity')} onClick={() => updateQuantity(item.productId, -1)}><Minus size={14} /></button>
                <span>{item.quantity}</span>
                <button aria-label={t('increase_quantity')} onClick={() => updateQuantity(item.productId, 1)}><Plus size={14} /></button>
                <button className="delete-btn" aria-label={t('remove_item')} onClick={() => removeFromCart(item.productId)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="empty-cart">{t('cart_empty')}</div>
          )}
        </div>

        {/* Cart Summary */}
        <div className="cart-summary">
          <div className="summary-row">
            <span>{t('subtotal')}</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>{t('tax')} ({taxRate}%)</span>
            <span>{formatPrice(tax)}</span>
          </div>
          <div className="summary-row">
            <label htmlFor="pos-discount">{t('discount')} (PKR)</label>
            <input
              id="pos-discount"
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="discount-input"
            />
          </div>
          <div className="summary-row total-row">
            <span>{t('total_due')}</span>
            <span>{formatPrice(total > 0 ? total : 0)}</span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="payment-methods">
          <button
            type="button"
            aria-pressed={paymentMethod === 'cash'}
            className={paymentMethod === 'cash' ? 'pay-btn active' : 'pay-btn'}
            onClick={() => setPaymentMethod('cash')}
          >
            <DollarSign size={16} /> {t('cash')}
          </button>
          <button
            type="button"
            aria-pressed={paymentMethod === 'card'}
            className={paymentMethod === 'card' ? 'pay-btn active' : 'pay-btn'}
            onClick={() => setPaymentMethod('card')}
          >
            <CreditCard size={16} /> {t('card')}
          </button>
        </div>

        {paymentMethod === 'cash' && (
          <div className="cash-details-form">
            <label htmlFor="cash-received">{t('cash_received')}</label>
            <input
              id="cash-received"
              type="number"
              min={total.toFixed(2)}
              step="0.01"
              value={cashReceived}
              onChange={(event) => setCashReceived(event.target.value)}
              className="card-input"
            />
            <div className="quick-cash" role="group" aria-label={t('cash_received')}>
              <button
                type="button"
                className="quick-cash-btn"
                disabled={total <= 0}
                onClick={() => setCashReceived(total.toFixed(2))}
              >
                {t('exact_amount')}
              </button>
              {quickCashAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="quick-cash-btn"
                  onClick={() => setCashReceived(String(amount))}
                >
                  {formatPrice(amount)}
                </button>
              ))}
            </div>
            <div className="cash-change-preview">
              {t('change_due')}: {formatPrice(Math.max(0, (cashReceived === '' ? total : Number(cashReceived)) - total))}
            </div>
          </div>
        )}

        {paymentMethod === 'card' && (
          <div className="card-details-form">
            <p className="card-sim-notice">{t('card_simulation')}</p>
            <div className="card-form-row">
              <label htmlFor="simulated-card-type">{t('card_type')}</label>
              <select
                id="simulated-card-type"
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
                className="card-input"
              >
                <option value="Visa">Visa</option>
                <option value="Mastercard">Mastercard</option>
                <option value="Amex">Amex</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        )}

        {/* Complete Sale Button */}
        <button
          type="button"
          className="checkout-btn"
          disabled={!activeShift || cart.length === 0 || loading}
          onClick={handleCheckout}
        >
          {!activeShift
            ? 'Open Shift Required to Sell'
            : loading
            ? t('processing')
            : `${t('pay_and_print')} (${formatPrice(total > 0 ? total : 0)})`}
        </button>
      </div>

      {/* Receipt Modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          title={t('sale_successful')}
          isSuccess={true}
          cashierName={user?.name}
          closeButtonText={t('new_sale')}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {/* Add Buyer Details Modal */}
      {showNewCustomerModal && (
        <AccessibleDialog className="modal" labelledBy="new-buyer-title" onClose={() => setShowNewCustomerModal(false)}>
            <h3 id="new-buyer-title">{t('add_new_customer')}</h3>
            {customerFormError && <div className="error-alert">{customerFormError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCustomerFormError('');
                const rawPhone = String(newCustomerForm.phone || '').trim();
                const phoneValidation = normalizePakistaniPhone(rawPhone);
                if (phoneValidation.error) {
                  setCustomerFormError(localizeCustomerValidationError(phoneValidation.error, t));
                  return;
                }
                try {
                  const lookupRes = await API.get(`/customers/lookup?phone=${encodeURIComponent(rawPhone)}`);
                  if (lookupRes.data.found) {
                    setSelectedCustomer(lookupRes.data.customer);
                    setShowNewCustomerModal(false);
                    setNewCustomerForm({ name: '', phone: '', email: '', marketingConsent: false });
                    return;
                  }
                  const customerValidation = validateCustomerDetails(newCustomerForm);
                  if (customerValidation.error) {
                    setCustomerFormError(localizeCustomerValidationError(customerValidation.error, t));
                    return;
                  }
                  const payload = {
                    ...customerValidation.data,
                    marketingConsent: newCustomerForm.marketingConsent || false
                  };
                  const res = await API.post('/customers', payload);
                  const createdCustomer = res.data;
                  setCustomers((prev) => [...prev, createdCustomer]);
                  setSelectedCustomer(createdCustomer);
                  setShowNewCustomerModal(false);
                  setNewCustomerForm({ name: '', phone: '', email: '', marketingConsent: false });
                } catch (err) {
                  const msg = err.response?.data?.message || 'Failed to process buyer details';
                  setCustomerFormError(msg);
                }
              }}
              className="modal-form"
            >
              <div className="form-group">
                <label htmlFor="buyer-phone">{t('buyer_phone_first')}</label>
                <input
                  id="buyer-phone"
                  type="text"
                  placeholder="e.g. 03001234567 or +923001234567"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  required
                  autoFocus
                />
                <small className="field-help">
                  {t('buyer_exists_notice')}
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="buyer-name">{t('buyer_name_if_new')}</label>
                <input
                  id="buyer-name"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="buyer-email">{t('email_optional')}</label>
                <input
                  id="buyer-email"
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                />
              </div>
              <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <input
                  type="checkbox"
                  id="directMarketingConsent"
                  checked={newCustomerForm.marketingConsent || false}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, marketingConsent: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="directMarketingConsent" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
                  {t('marketing_opt_in')}
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowNewCustomerModal(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary">
                  {t('save_and_select')}
                </button>
              </div>
            </form>
        </AccessibleDialog>
      )}
    </div>
  );
}