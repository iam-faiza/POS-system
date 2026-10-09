import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Search, Plus, Minus, Trash2, CreditCard, DollarSign, CheckCircle, Printer } from 'lucide-react';

export default function PosTerminal() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null); // Customer object or null
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', email: '' });
  const [customerFormError, setCustomerFormError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(5); // 5% default tax
  const [completedSale, setCompletedSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, catRes, custRes] = await Promise.all([
        API.get('/products'),
        API.get('/categories'),
        API.get('/customers')
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
      setCustomers(custRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load POS data');
    }
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
    setCart((prevCart) => {
      return prevCart
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
        .filter((item) => item.quantity > 0);
    });
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Number(((subtotal * taxRate) / 100).toFixed(2));
  const discountAmount = Number(discount || 0);
  const total = Number((subtotal + tax - discountAmount).toFixed(2));

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError('');

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
        paymentMethod
      };

      const res = await API.post('/sales', saleData);
      setCompletedSale(res.data);
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setCustomerSearchQuery('');
      fetchData(); // Refresh product stock
    } catch (err) {
      setError(err.response?.data?.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category?._id === selectedCategory || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
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
              placeholder="Search by name or SKU..."
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
            All Products
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
                <span className="product-price">${p.price.toFixed(2)}</span>
                <span className={`stock-badge ${p.stockQuantity <= p.lowStockThreshold ? 'low' : ''}`}>
                  Stock: {p.stockQuantity}
                </span>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="no-products">No products found</div>
          )}
        </div>
      </div>

      {/* Cart & Checkout Panel */}
      <div className="pos-cart-panel">
        <div className="cart-header">
          <h3>Current Sale</h3>
          <span className="cart-count">{cart.reduce((s, i) => s + i.quantity, 0)} items</span>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <div className="customer-select-area">
          <div className="customer-select-header">
            <label>Buyer / Customer:</label>
            <button
              type="button"
              className="btn-link-sm"
              onClick={() => {
                setCustomerFormError('');
                setNewCustomerForm({ phone: '', name: '', email: '', marketingConsent: false, step: 'phone', existingCustomer: null });
                setShowNewCustomerModal(true);
              }}
            >
              <Plus size={14} /> Add Buyer Details
            </button>
          </div>

          {selectedCustomer ? (
            <div className="selected-customer-card">
              <div className="selected-customer-info">
                <strong>{selectedCustomer.name}</strong>
                <span>{selectedCustomer.phone} {selectedCustomer.marketingConsent ? '(SMS Opted-In)' : ''}</span>
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
                    setCustomerSearchQuery(e.target.value);
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
                    <strong>Walk-in / Unknown Buyer</strong>
                    <span className="muted">No customer assigned</span>
                  </div>
                  {customers
                    .filter((c) => {
                      const q = customerSearchQuery.toLowerCase();
                      return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q);
                    })
                    .map((c) => (
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
                </div>
              )}
            </div>
          )}
        </div>

        <div className="cart-items-list">
          {cart.map((item) => (
            <div key={item.productId} className="cart-item">
              <div className="cart-item-info">
                <span className="cart-item-name">{item.name}</span>
                <span className="cart-item-price">${(item.price * item.quantity).toFixed(2)}</span>
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
            <div className="empty-cart">Cart is empty. Click products to add.</div>
          )}
        </div>

        <div className="cart-summary">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Tax ({taxRate}%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Discount ($)</span>
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="discount-input"
            />
          </div>
          <div className="summary-row total-row">
            <span>Total</span>
            <span>${total > 0 ? total.toFixed(2) : '0.00'}</span>
          </div>
        </div>

        <div className="payment-methods">
          <button
            className={paymentMethod === 'cash' ? 'pay-btn active' : 'pay-btn'}
            onClick={() => setPaymentMethod('cash')}
          >
            <DollarSign size={16} /> Cash
          </button>
          <button
            className={paymentMethod === 'card' ? 'pay-btn active' : 'pay-btn'}
            onClick={() => setPaymentMethod('card')}
          >
            <CreditCard size={16} /> Card
          </button>
        </div>

        <button
          className="checkout-btn"
          disabled={cart.length === 0 || loading}
          onClick={handleCheckout}
        >
          {loading ? 'Processing...' : `Complete Sale ($${total > 0 ? total.toFixed(2) : '0.00'})`}
        </button>
      </div>

      {/* Receipt Modal */}
      {completedSale && (
        <div className="modal-backdrop">
          <div className="receipt-modal">
            <div className="receipt-success-icon">
              <CheckCircle size={48} color="#10b981" />
            </div>
            <h2>Sale Successful!</h2>
            <p className="invoice-num">Invoice: {completedSale.invoiceNumber}</p>

            <div className="receipt-details">
              <div className="receipt-row">
                <span>Date:</span>
                <span>{new Date(completedSale.createdAt).toLocaleString()}</span>
              </div>
              <div className="receipt-row">
                <span>Payment:</span>
                <span className="uppercase">{completedSale.paymentMethod}</span>
              </div>
              <div className="receipt-divider"></div>
              {completedSale.items.map((i, idx) => (
                <div key={idx} className="receipt-item-row">
                  <span>{i.name} x {i.quantity}</span>
                  <span>${(i.price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="receipt-divider"></div>
              <div className="receipt-row">
                <span>Subtotal:</span>
                <span>${completedSale.subtotal.toFixed(2)}</span>
              </div>
              <div className="receipt-row">
                <span>Tax:</span>
                <span>${completedSale.tax.toFixed(2)}</span>
              </div>
              <div className="receipt-row">
                <span>Discount:</span>
                <span>${completedSale.discount.toFixed(2)}</span>
              </div>
              <div className="receipt-row receipt-total">
                <span>Total:</span>
                <span>${completedSale.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="receipt-actions">
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer size={16} /> Print Receipt
              </button>
              <button className="btn-primary" onClick={() => setCompletedSale(null)}>
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Buyer Details Modal in Checkout */}
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

                if (newCustomerForm.step === 'phone') {
                  // Step 1: Check if customer with this normalized phone already exists
                  try {
                    const res = await API.get(`/customers/lookup?phone=${encodeURIComponent(rawPhone)}`);
                    if (res.data.found) {
                      // Existing customer found! Do not overwrite, allow selecting
                      setNewCustomerForm({
                        ...newCustomerForm,
                        step: 'found',
                        existingCustomer: res.data.customer
                      });
                    } else {
                      // Not found: proceed to collect name and optional email/consent
                      setNewCustomerForm({
                        ...newCustomerForm,
                        step: 'create'
                      });
                    }
                  } catch (err) {
                    setCustomerFormError(err.response?.data?.message || 'Failed to lookup phone');
                  }
                } else if (newCustomerForm.step === 'create') {
                  // Step 2: Validate name and create customer
                  const rawName = String(newCustomerForm.name || '').trim();
                  if (!rawName) { setCustomerFormError('Customer name is required'); return; }
                  if (rawName.length < 2) { setCustomerFormError('Customer name must be at least 2 characters'); return; }
                  if (rawName.length > 60) { setCustomerFormError('Customer name cannot exceed 60 characters'); return; }
                  if (!/[a-zA-Z\u00C0-\u024F\u0600-\u06FF]/.test(rawName)) { setCustomerFormError('Customer name must contain at least one letter'); return; }

                  const email = String(newCustomerForm.email || '').trim();
                  if (email !== '') {
                    if (/\s/.test(email)) { setCustomerFormError('Email cannot contain spaces'); return; }
                    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
                    if (!emailRegex.test(email)) { setCustomerFormError('Please enter a valid email address'); return; }
                  }

                  try {
                    const payload = {
                      name: newCustomerForm.name,
                      phone: newCustomerForm.phone,
                      email: newCustomerForm.email || undefined,
                      marketingConsent: newCustomerForm.marketingConsent
                    };
                    const res = await API.post('/customers', payload);
                    const createdCustomer = res.data;
                    setCustomers((prev) => [...prev, createdCustomer]);
                    setSelectedCustomer(createdCustomer);
                    setShowNewCustomerModal(false);
                  } catch (err) {
                    setCustomerFormError(err.response?.data?.message || 'Failed to create customer');
                  }
                }
              }}
              className="modal-form"
            >
              {newCustomerForm.step === 'phone' && (
                <>
                  <div className="form-group">
                    <label>Enter Buyer Phone Number First</label>
                    <input
                      type="text"
                      placeholder="e.g. 03001234567 or +923001234567"
                      value={newCustomerForm.phone}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                      required
                      autoFocus
                    />
                    <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      We will check if this customer already exists in the system.
                    </small>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowNewCustomerModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Next / Lookup
                    </button>
                  </div>
                </>
              )}

              {newCustomerForm.step === 'found' && newCustomerForm.existingCustomer && (
                <>
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Existing Customer Found!</h4>
                    <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Name:</strong> {newCustomerForm.existingCustomer.name}</p>
                    <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Phone:</strong> {newCustomerForm.existingCustomer.phone}</p>
                    <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Email:</strong> {newCustomerForm.existingCustomer.email || 'N/A'}</p>
                    <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>SMS Opt-in:</strong> {newCustomerForm.existingCustomer.marketingConsent ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setNewCustomerForm({ ...newCustomerForm, step: 'phone', existingCustomer: null })}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setSelectedCustomer(newCustomerForm.existingCustomer);
                        setShowNewCustomerModal(false);
                      }}
                    >
                      Select Customer for Sale
                    </button>
                  </div>
                </>
              )}

              {newCustomerForm.step === 'create' && (
                <>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '13px', color: '#991b1b' }}>
                    No existing customer found with phone <strong>{newCustomerForm.phone}</strong>. Please enter details to register.
                  </div>
                  <div className="form-group">
                    <label>Customer Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newCustomerForm.name}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      value={newCustomerForm.phone}
                      disabled
                      style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
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
                      id="checkoutMarketingConsent"
                      checked={newCustomerForm.marketingConsent}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, marketingConsent: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="checkoutMarketingConsent" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
                      Opt-in for Marketing SMS
                    </label>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setNewCustomerForm({ ...newCustomerForm, step: 'phone' })}
                    >
                      Back
                    </button>
                    <button type="submit" className="btn-primary">
                      Create & Select
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
