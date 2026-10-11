import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';
import { Search, Plus, Minus, Trash2, CreditCard, DollarSign } from 'lucide-react';
import ReceiptModal from './ReceiptModal';
import { useSettings } from '../context/SettingsContext';

export default function PosTerminal({ user }) {
  const { t, formatPrice, currency } = useSettings();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
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
  const [cardDetails, setCardDetails] = useState({
    cardType: 'Visa',
    cardholderName: '',
    last4: '',
    transactionRef: ''
  });
  const [discount, setDiscount] = useState(0);
  const [taxRate] = useState(5);
  const [completedSale, setCompletedSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    fetchData();
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        API.get('/products?activeOnly=true'),
        API.get('/categories')
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load POS data');
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
      alert('Product is out of stock!');
      return;
    }
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product._id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          alert('Cannot add more than available stock.');
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
              alert('Exceeds available stock');
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

  const validateCardDetails = () => {
    if (!cardDetails.cardholderName.trim()) {
      setError('Cardholder name is required for card payments.');
      return false;
    }
    if (!/^\d{4}$/.test(cardDetails.last4)) {
      setError('Please enter exactly 4 digits for the card number.');
      return false;
    }
    if (!cardDetails.transactionRef.trim()) {
      setError('Auth reference / transaction ref is required.');
      return false;
    }
    return true;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setError('');

    if (paymentMethod === 'card' && !validateCardDetails()) return;

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
        ...(paymentMethod === 'card' && {
          paymentDetails: {
            cardType: cardDetails.cardType,
            cardholderName: cardDetails.cardholderName.trim(),
            last4: cardDetails.last4,
            transactionRef: cardDetails.transactionRef.trim()
          }
        })
      };

      const res = await API.post('/sales', saleData);
      setCompletedSale(res.data);
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setCustomerSearchQuery('');
      setCardDetails({ cardType: 'Visa', cardholderName: '', last4: '', transactionRef: '' });
      setPaymentMethod('cash');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Checkout failed');
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

  return (
    <div className="pos-container">
      {/* Product Catalog Section */}
      <div className="pos-catalog">
        <div className="catalog-header">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder={t('search_products')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
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
            <div
              key={p._id}
              className={`product-card ${p.stockQuantity <= 0 ? 'out-of-stock' : ''}`}
              onClick={() => addToCart(p)}
            >
              <div className="product-name">{p.name}</div>
              <div className="product-sku">SKU: {p.sku}</div>
              <div className="product-footer">
                <span className="product-price">{formatPrice(p.price)}</span>
                <span className={`stock-badge ${p.stockQuantity <= p.lowStockThreshold ? 'low' : ''}`}>
                  {t('stock')}: {p.stockQuantity}
                </span>
              </div>
            </div>
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
                <span>{selectedCustomer.phone}{selectedCustomer.marketingConsent ? ' (SMS Opted-In)' : ''}</span>
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
                  placeholder="Search by name or phone..."
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
                  <div
                    className="customer-dropdown-item walk-in"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearchQuery('');
                      setShowCustomerDropdown(false);
                    }}
                  >
                    <strong>{t('walk_in_customer')}</strong>
                    <span className="muted">No customer assigned</span>
                  </div>
                  {customers.map((c) => (
                    <div
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
                    </div>
                  ))}
                  {customers.length === 0 && customerSearchQuery.trim().length > 0 && (
                    <div className="customer-dropdown-no-results">No customers found</div>
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
                <button onClick={() => updateQuantity(item.productId, -1)}><Minus size={14} /></button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.productId, 1)}><Plus size={14} /></button>
                <button className="delete-btn" onClick={() => removeFromCart(item.productId)}><Trash2 size={14} /></button>
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
            <span>{t('tax')}</span>
            <span>{formatPrice(tax)}</span>
          </div>
          <div className="summary-row">
            <span>{t('discount')} (₨)</span>
            <input
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
          {currency !== 'PKR' && (
            <div className="summary-row" style={{ fontSize: '11px', color: '#6366f1' }}>
              <span>PKR base:</span>
              <span>₨ {(total > 0 ? total : 0).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Payment Method Selection */}
        <div className="payment-methods">
          <button
            className={paymentMethod === 'cash' ? 'pay-btn active' : 'pay-btn'}
            onClick={() => setPaymentMethod('cash')}
          >
            <DollarSign size={16} /> {t('cash')}
          </button>
          <button
            className={paymentMethod === 'card' ? 'pay-btn active' : 'pay-btn'}
            onClick={() => setPaymentMethod('card')}
          >
            <CreditCard size={16} /> {t('card')}
          </button>
        </div>

        {/* Card Details Form (simulated – no real processing) */}
        {paymentMethod === 'card' && (
          <div className="card-details-form">
            <p className="card-sim-notice">⚠️ Simulation only — no real payment processing</p>
            <div className="card-form-row">
              <label>{t('card_type')}</label>
              <select
                value={cardDetails.cardType}
                onChange={(e) => setCardDetails({ ...cardDetails, cardType: e.target.value })}
                className="card-input"
              >
                <option value="Visa">Visa</option>
                <option value="Mastercard">Mastercard</option>
                <option value="Amex">Amex</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="card-form-row">
              <label>{t('cardholder_name')}</label>
              <input
                type="text"
                placeholder="e.g. John Doe"
                value={cardDetails.cardholderName}
                onChange={(e) => setCardDetails({ ...cardDetails, cardholderName: e.target.value })}
                className="card-input"
                maxLength={60}
              />
            </div>
            <div className="card-form-row">
              <label>{t('last4_digits')}</label>
              <input
                type="text"
                placeholder="1234"
                value={cardDetails.last4}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setCardDetails({ ...cardDetails, last4: v });
                }}
                className="card-input"
                maxLength={4}
                inputMode="numeric"
              />
            </div>
            <div className="card-form-row">
              <label>{t('auth_ref')}</label>
              <input
                type="text"
                placeholder="e.g. TXN-2024-001"
                value={cardDetails.transactionRef}
                onChange={(e) => setCardDetails({ ...cardDetails, transactionRef: e.target.value })}
                className="card-input"
                maxLength={40}
              />
            </div>
          </div>
        )}

        {/* Complete Sale Button */}
        <button
          className="checkout-btn"
          disabled={cart.length === 0 || loading}
          onClick={handleCheckout}
        >
          {loading
            ? t('processing')
            : `${t('pay_and_print')} (₨ ${total > 0 ? total.toFixed(2) : '0.00'})`}
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
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Add Buyer Details</h3>
            {customerFormError && <div className="error-alert">{customerFormError}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCustomerFormError('');
                const rawPhone = String(newCustomerForm.phone || '').trim();
                if (!rawPhone) { setCustomerFormError('Phone number is required'); return; }
                if (/[a-zA-Z]/.test(rawPhone)) { setCustomerFormError('Phone number cannot contain letters'); return; }
                const digitsOnly = rawPhone.replace(/\D/g, '');
                if (digitsOnly.length < 10) { setCustomerFormError('Phone number is too short'); return; }
                if (digitsOnly.length > 13) { setCustomerFormError('Phone number is too long'); return; }
                const pakPhoneRegex = /^(?:(?:\+92|0092|92)|0)[2-9]\d{8,9}$/;
                if (!pakPhoneRegex.test(rawPhone.replace(/[\s\-().]/g, ''))) {
                  setCustomerFormError('Please enter a valid Pakistani phone number (e.g., 03001234567)');
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
                  const rawName = String(newCustomerForm.name || '').trim();
                  if (!rawName) { setCustomerFormError('Customer name is required for new customers'); return; }
                  if (rawName.length < 2) { setCustomerFormError('Customer name must be at least 2 characters'); return; }
                  if (rawName.length > 60) { setCustomerFormError('Customer name cannot exceed 60 characters'); return; }
                  if (!/[a-zA-Z\u00C0-\u024F\u0600-\u06FF]/.test(rawName)) { setCustomerFormError('Customer name must contain at least one letter'); return; }
                  const email = String(newCustomerForm.email || '').trim();
                  if (email !== '') {
                    if (/\s/.test(email)) { setCustomerFormError('Email cannot contain spaces'); return; }
                    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
                    if (!emailRegex.test(email)) { setCustomerFormError('Please enter a valid email address'); return; }
                  }
                  const payload = {
                    name: newCustomerForm.name,
                    phone: newCustomerForm.phone,
                    email: newCustomerForm.email || undefined,
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
                <label>Phone Number (Required first)</label>
                <input
                  type="text"
                  placeholder="e.g. 03001234567 or +923001234567"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  required
                  autoFocus
                />
                <small style={{ color: '#64748b', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                  If this phone number exists, the customer is reused automatically.
                </small>
              </div>
              <div className="form-group">
                <label>Customer Name (Required if new)</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Email (Optional)</label>
                <input
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
                  Opt-in for Marketing SMS
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowNewCustomerModal(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn-primary">
                  {t('save')} & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
