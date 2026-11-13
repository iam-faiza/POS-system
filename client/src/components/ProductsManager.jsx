import React, { useState, useEffect, useRef } from 'react';
import API from '../services/api';
import { Plus, Edit, Trash2, AlertTriangle, Search, Filter, AlertCircle, CheckCircle, RotateCcw, Archive, History } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { isAdminUser } from '../utils/roles';
import AccessibleDialog from './AccessibleDialog';

export default function ProductsManager({ user }) {
  const { formatPrice, t } = useSettings();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'archived'
  const [products, setProducts] = useState([]);
  const [archivedProducts, setArchivedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [archivedSearchQuery, setArchivedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [archivedCategory, setArchivedCategory] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [movementProduct, setMovementProduct] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const searchTimeoutRef = useRef(null);
  const archivedSearchTimeoutRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    price: '',
    stockQuantity: '',
    lowStockThreshold: 5,
    costPrice: '',
    stockAdjustmentReason: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = isAdminUser(user);

  useEffect(() => {
    fetchInitialData();
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (archivedSearchTimeoutRef.current) clearTimeout(archivedSearchTimeoutRef.current);
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        API.get('/products'),
        API.get('/categories')
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
      if (isAdmin) {
        const arcRes = await API.get('/products/archived');
        setArchivedProducts(arcRes.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async (search = searchQuery, category = selectedCategory) => {
    try {
      const params = new URLSearchParams();
      if (search && search.trim()) params.append('search', search.trim());
      if (category && category !== 'all') params.append('category', category);
      const res = await API.get(`/products${params.toString() ? `?${params.toString()}` : ''}`);
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchArchivedProducts = async (search = archivedSearchQuery, category = archivedCategory) => {
    try {
      const params = new URLSearchParams();
      if (search && search.trim()) params.append('search', search.trim());
      if (category && category !== 'all') params.append('category', category);
      const res = await API.get(`/products/archived${params.toString() ? `?${params.toString()}` : ''}`);
      setArchivedProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => fetchProducts(query, selectedCategory), 300);
  };

  const handleArchivedSearch = (e) => {
    const query = e.target.value;
    setArchivedSearchQuery(query);
    if (archivedSearchTimeoutRef.current) clearTimeout(archivedSearchTimeoutRef.current);
    archivedSearchTimeoutRef.current = setTimeout(() => fetchArchivedProducts(query, archivedCategory), 300);
  };

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    setSelectedCategory(cat);
    fetchProducts(searchQuery, cat);
  };

  const handleArchivedCategoryChange = (e) => {
    const cat = e.target.value;
    setArchivedCategory(cat);
    fetchArchivedProducts(archivedSearchQuery, cat);
  };

  const resetImageSelection = (product = null) => {
    setSelectedImage(null);
    setRemoveImage(false);
    setImagePreview(product?.image || '');
  };

  const handleOpenAdd = () => {
    setEditProduct(null);
    setError('');
    setFormData({
      name: '',
      sku: '',
      category: categories[0]?._id || '',
      price: '',
      stockQuantity: '',
      lowStockThreshold: 5,
      costPrice: '',
      stockAdjustmentReason: ''
    });
    resetImageSelection();
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setEditProduct(p);
    setError('');
    setFormData({
      name: p.name.endsWith(' (Archived)') ? p.name.slice(0, -' (Archived)'.length) : p.name,
      sku: p.sku,
      category: p.category?._id || p.category,
      price: p.price,
      costPrice: p.costPrice ?? '',
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      stockAdjustmentReason: ''
    });
    resetImageSelection(p);
    setShowModal(true);
  };

  const validateForm = () => {
    const name = String(formData.name || '').trim();
    const sku = String(formData.sku || '').trim().toUpperCase();
    if (name.length < 2) return 'Product name must be at least 2 characters';
    if (name.length > 100) return 'Product name cannot exceed 100 characters';
    if (!/^[A-Z0-9_-]{3,50}$/.test(sku)) return 'SKU must be 3-50 characters and contain only letters, numbers, hyphens, or underscores';
    if (formData.costPrice !== '' && (!Number.isFinite(Number(formData.costPrice)) || Number(formData.costPrice) < 0)) {
      return 'Cost price must be zero or more, or left empty';
    }
    if (!formData.category) return 'Please select a category';
    const price = Number(formData.price);
    if (!Number.isFinite(price) || price <= 0) return 'Price must be greater than 0';
    const stock = Number(formData.stockQuantity);
    if (!Number.isSafeInteger(stock) || stock < 0) return 'Stock quantity must be a non-negative whole number';
    const threshold = Number(formData.lowStockThreshold);
    if (!Number.isSafeInteger(threshold) || threshold < 0) return 'Low stock threshold must be a non-negative whole number';
    return null;
  };

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPG, PNG, or WEBP image.');
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be 2 MB or less.');
      event.target.value = '';
      return;
    }

    setSelectedImage(file);
    setRemoveImage(false);
    setImagePreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }

    const cleanedData = {
      ...formData,
      name: String(formData.name).trim(),
      sku: String(formData.sku).trim().toUpperCase(),
      price: Number(formData.price),
      stockQuantity: Number(formData.stockQuantity),
      lowStockThreshold: Number(formData.lowStockThreshold),
      costPrice: formData.costPrice === '' ? null : Number(formData.costPrice),
      stockAdjustmentReason: formData.stockAdjustmentReason
    };

    try {
      const payload = new FormData();
      Object.entries(cleanedData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          payload.append(key, value);
        }
      });

      if (selectedImage) {
        payload.append('image', selectedImage);
      }
      if (removeImage) {
        payload.append('removeImage', 'true');
      }

      if (editProduct) {
        await API.put(`/products/${editProduct._id}`, payload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setFeedback({ type: 'success', message: `Product "${cleanedData.name}" updated successfully` });
      } else {
        await API.post('/products', payload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setFeedback({ type: 'success', message: `Product "${cleanedData.name}" created successfully` });
      }
      setShowModal(false);
      fetchProducts(searchQuery, selectedCategory);
      if (isAdmin) fetchArchivedProducts(archivedSearchQuery, archivedCategory);
    } catch (err) {
      setError(err.response?.data?.message || t('edit_failed'));
    }
  };

  const handleViewStockMovements = async (product) => {
    try {
      const response = await API.get(`/products/${product._id}/stock-movements`);
      setStockMovements(response.data);
      setMovementProduct(product);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || t('product_load_stock_failed') });
    }
  };

  const handleDelete = async (p) => {
    const confirmMsg = `${t('confirm_product_archive')}\n\n${p.name} (${p.sku})`;
    if (!window.confirm(confirmMsg)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await API.delete(`/products/${p._id}`);
      setFeedback({ type: 'success', message: res.data.message || t('product_remove_failed') });
      fetchProducts(searchQuery, selectedCategory);
      if (isAdmin) fetchArchivedProducts(archivedSearchQuery, archivedCategory);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || t('product_archive_failed') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (p) => {
    if (!window.confirm(`${t('confirm_product_restore')}\n\n${p.name}`)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await API.patch(`/products/${p._id}/restore`);
      setFeedback({ type: 'success', message: res.data.message || 'Product restored successfully' });
      fetchProducts(searchQuery, selectedCategory);
      fetchArchivedProducts(archivedSearchQuery, archivedCategory);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || t('product_restore_failed') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (products.length === 0) {
      showToast(t('no_active_products_to_delete'), 'error');
      return;
    }
    const confirmMsg = t('confirm_bulk_product_delete');
    if (!window.confirm(confirmMsg)) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await API.delete('/products');
      setFeedback({ type: 'success', message: res.data.message });
      fetchProducts(searchQuery, selectedCategory);
      if (isAdmin) fetchArchivedProducts(archivedSearchQuery, archivedCategory);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || t('bulk_product_failed') });
    } finally {
      setActionLoading(false);
    }
  };

  const displayedList = activeTab === 'active' ? products : archivedProducts;

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>{t('products_and_inventory')}</h2>
        <div className="toolbar">
          {/* Search box */}
          {activeTab === 'active' ? (
            <div className="search-box">
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                aria-label={t('search_products_input')}
                placeholder={t('search_products_input')}
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
          ) : (
            <div className="search-box">
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                aria-label={t('search_archived_products')}
                placeholder={t('search_archived_products')}
                value={archivedSearchQuery}
                onChange={handleArchivedSearch}
              />
            </div>
          )}

          {/* Category filter */}
          {activeTab === 'active' ? (
            <div className="search-box select-box">
              <Filter size={16} color="var(--text-muted)" />
              <select
                value={selectedCategory}
                onChange={handleCategoryChange}
              >
                <option value="all">{t('all_categories')}</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="search-box select-box">
              <Filter size={16} color="var(--text-muted)" />
              <select
                value={archivedCategory}
                onChange={handleArchivedCategoryChange}
              >
                <option value="all">{t('all_categories')}</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {isAdmin && activeTab === 'active' && (
            <button
              className="btn-danger" onClick={handleBulkDelete}
              disabled={actionLoading}
              title={t('delete_all_products')}
            >
              <Trash2 size={16} /> {t('delete_all_products')}
            </button>
          )}
          {isAdmin && activeTab === 'active' && (
            <button className="btn-primary" onClick={handleOpenAdd} disabled={actionLoading}>
              <Plus size={16} /> {t('add_product')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="tab-bar" role="tablist">
          <button
            onClick={() => setActiveTab('active')}
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          >
            {t('active_products')} ({products.length})
          </button>
          <button
            onClick={() => { setActiveTab('archived'); fetchArchivedProducts(archivedSearchQuery, archivedCategory); }}
            className={`tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
          >
            <Archive size={14} /> {t('archived_products')} ({archivedProducts.length})
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={feedback.type === 'success' ? 'success-alert' : 'error-alert'}
        >
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('product_name')}</th>
              <th>{t('sku')}</th>
              <th>{t('category')}</th>
              <th>{t('price')}</th>
              <th>{t('stock')}</th>
              {isAdmin && <th>{t('actions')}</th>}
            </tr>
          </thead>

          <tbody>
            {displayedList.map((p) => {
              const isLow = isAdmin && p.stockQuantity <= p.lowStockThreshold;
              const displayName = activeTab === 'archived' && p.name.endsWith(' (Archived)')
                ? p.name.slice(0, -' (Archived)'.length)
                : p.name;

              return (
                <tr key={p._id}>
                  <td>
                    <div className="product-name-cell">
                      <img
                        className="product-thumbnail"
                        src={p.image || '/product-placeholder.svg'}
                        alt={displayName}
                        onError={(event) => {
                          event.currentTarget.src = '/product-placeholder.svg';
                        }}
                      />
                      <div>
                        <strong>{displayName}</strong>
                        {activeTab === 'archived' && (
                          <span className="badge warning badge-inline">
                            Archived
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td><code>{p.sku}</code></td>
                  <td>{p.category?.name || 'Uncategorized'}</td>
                  <td>{formatPrice(p.price)}</td>
                  <td>
                    <span className={`stock-pill ${isLow && activeTab === 'active' ? 'low' : ''}`}>
                      {isLow && activeTab === 'active' && <AlertTriangle size={14} />}
                      {p.stockQuantity}
                    </span>
                  </td>

                  {isAdmin && (
                    <td>
                      {activeTab === 'active' && (
                        <button
                          className="icon-btn"
                          onClick={() => handleOpenEdit(p)}
                          title={t('edit_product')}
                          aria-label={`${t('edit_product')}: ${displayName}`}
                          disabled={actionLoading}
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      <button
                        className="icon-btn"
                        onClick={() => handleViewStockMovements(p)}
                          title={t('stock_history')}
                        aria-label={`${t('stock_history')}: ${displayName}`}
                        disabled={actionLoading}
                      >
                        <History size={16} />
                      </button>

                      {activeTab === 'archived' ? (
                        <button
                          className="icon-btn"
                          onClick={() => handleRestore(p)}
                          title={t('restore_product')}
                          aria-label={`${t('restore_product')}: ${displayName}`}
                          disabled={actionLoading}
                        >
                          <RotateCcw size={16} />
                        </button>
                      ) : (
                        <button
                          className="icon-btn danger"
                          onClick={() => handleDelete(p)}
                          title={t('archive_product')}
                          aria-label={`${t('archive_product')}: ${displayName}`}
                          disabled={actionLoading}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}

            {displayedList.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 6 : 5} className="empty-cell"
                >
                  {activeTab === 'active'
                    ? (searchQuery || selectedCategory !== 'all'
                      ? t('no_products')
                      : t('no_active_products'))
                    : (archivedSearchQuery || archivedCategory !== 'all'
                      ? t('no_archived_products_match')
                      : t('no_archived_products'))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AccessibleDialog className="modal manager-dialog" labelledBy="product-dialog-title" onClose={() => setShowModal(false)}>
            <h3 id="product-dialog-title">{editProduct ? (activeTab === 'archived' ? t('edit_archived_product') : t('edit_product')) : t('add_new_product')}</h3>

            {error && <div className="error-alert">{error}</div>}

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="product-name">{t('product_name')}</label>
                <input
                  id="product-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  minLength="2"
                  maxLength="100"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="product-sku">{t('sku')}</label>
                <input
                  id="product-sku"
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  minLength="3"
                  maxLength="50"
                  pattern="[A-Z0-9_-]{3,50}"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="product-category">{t('category')}</label>
                <select
                  id="product-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="">{t('select_category')}</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Product image (optional)</label>
                <div className="product-image-upload">
                  <img
                    src={imagePreview || '/product-placeholder.svg'}
                    alt="Product preview"
                    className="image-upload-preview"
                    onError={(event) => {
                      event.currentTarget.src = '/product-placeholder.svg';
                    }}
                  />
                  <div className="image-upload-actions">
                    <label className="btn-secondary file-picker-btn">
                      {imagePreview ? 'Change image' : 'Upload image'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageSelection}
                      />
                    </label>
                    {(imagePreview || editProduct?.image) && (
                      <button
                        type="button"
                        className="btn-link-sm"
                        onClick={() => {
                          setSelectedImage(null);
                          setRemoveImage(true);
                          setImagePreview('');
                        }}
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="product-price">{t('product_price_base')}</label>
                <input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="product-cost">Cost price (optional, for profit)</label>
                <input
                  id="product-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="Leave empty if unknown"
                />
                <small className="field-help">Profit is only calculated for sales where the cost is known. Changing it affects future sales only.</small>
              </div>

              <div className="form-group">
                <label htmlFor="product-stock">{t('stock')}</label>
                <input
                  id="product-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="product-threshold">{t('low_stock_threshold')}</label>
                <input
                  id="product-threshold"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.lowStockThreshold}
                  onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                  required
                />
              </div>

              {editProduct && (
                <div className="form-group">
                  <label htmlFor="stock-adjustment-reason">{t('stock_adjustment_reason')}</label>
                  <input
                    id="stock-adjustment-reason"
                    type="text"
                    maxLength={160}
                    value={formData.stockAdjustmentReason}
                    onChange={(e) => setFormData({ ...formData, stockAdjustmentReason: e.target.value })}
                    placeholder={t('optional_reason')}
                  />
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="btn-primary">
                  Save
                </button>
              </div>
            </form>
        </AccessibleDialog>
      )}

      {movementProduct && (
        <AccessibleDialog className="modal stock-history-dialog" labelledBy="stock-history-title" onClose={() => setMovementProduct(null)}>
            <h3 id="stock-history-title">{t('stock_history')}: {movementProduct.name}</h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>{t('movement_date')}</th><th>{t('movement_reason')}</th><th>{t('movement_change')}</th><th>{t('quantity_before')}</th><th>{t('quantity_after')}</th><th>{t('performed_by')}</th></tr></thead>
                <tbody>
                  {stockMovements.map((movement) => (
                    <tr key={movement._id}>
                      <td>{new Date(movement.createdAt).toLocaleString()}</td>
                      <td>{movement.reason}</td>
                      <td>{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}</td>
                      <td>{movement.quantityBefore}</td>
                      <td>{movement.quantityAfter}</td>
                      <td>{movement.user?.name || 'Unknown'}</td>
                    </tr>
                  ))}
                  {stockMovements.length === 0 && <tr><td colSpan={6}>{t('no_stock_movements')}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setMovementProduct(null)}>{t('close')}</button>
            </div>
        </AccessibleDialog>
      )}
    </div>
  );
}
