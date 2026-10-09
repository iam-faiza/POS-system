import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';

export default function ProductsManager({ user }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    price: '',
    stockQuantity: '',
    lowStockThreshold: 5
  });
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        API.get('/products'),
        API.get('/categories')
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error(err);
    }
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
      lowStockThreshold: 5
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setEditProduct(p);
    setError('');
    setFormData({
      name: p.name,
      sku: p.sku,
      category: p.category?._id || p.category,
      price: p.price,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold
    });
    setShowModal(true);
  };

  const validateForm = () => {
    const name = String(formData.name || '').trim();
    const sku = String(formData.sku || '').trim().toUpperCase();

    if (name.length < 2) {
      return 'Product name must be at least 2 characters';
    }

    if (name.length > 100) {
      return 'Product name cannot exceed 100 characters';
    }

    if (!/^[A-Z0-9_-]{3,50}$/.test(sku)) {
      return 'SKU must be 3-50 characters and contain only letters, numbers, hyphens, or underscores';
    }

    if (!formData.category) {
      return 'Please select a category';
    }

    const price = Number(formData.price);

    if (!Number.isFinite(price) || price <= 0) {
      return 'Price must be greater than 0';
    }

    const stock = Number(formData.stockQuantity);

    if (!Number.isFinite(stock) || stock < 0) {
      return 'Stock quantity cannot be negative';
    }

    const threshold = Number(formData.lowStockThreshold);

    if (!Number.isFinite(threshold) || threshold < 0) {
      return 'Low stock threshold cannot be negative';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const cleanedData = {
      ...formData,
      name: String(formData.name).trim(),
      sku: String(formData.sku).trim().toUpperCase(),
      price: Number(formData.price),
      stockQuantity: Number(formData.stockQuantity),
      lowStockThreshold: Number(formData.lowStockThreshold)
    };

    try {
      if (editProduct) {
        await API.put(`/products/${editProduct._id}`, cleanedData);
      } else {
        await API.post('/products', cleanedData);
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await API.delete(`/products/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete product');
    }
  };

  return (
    <div className="manager-container">
      <div className="manager-header">
        <h2>Products & Inventory</h2>
        {isAdmin && (
          <button className="btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Add Product
          </button>
        )}
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {products.map((p) => {
              const isLow = p.stockQuantity <= p.lowStockThreshold;

              return (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td><code>{p.sku}</code></td>
                  <td>{p.category?.name || 'Uncategorized'}</td>
                  <td>${Number(p.price).toFixed(2)}</td>
                  <td>
                    <span className={`stock-pill ${isLow ? 'low' : ''}`}>
                      {isLow && <AlertTriangle size={14} />}
                      {p.stockQuantity}
                    </span>
                  </td>

                  {isAdmin && (
                    <td>
                      <button
                        className="icon-btn"
                        onClick={() => handleOpenEdit(p)}
                      >
                        <Edit size={16} />
                      </button>

                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(p._id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{editProduct ? 'Edit Product' : 'Add New Product'}</h3>

            {error && <div className="error-alert">{error}</div>}

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value
                    })
                  }
                  minLength="2"
                  maxLength="100"
                  required
                />
              </div>

              <div className="form-group">
                <label>SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sku: e.target.value.toUpperCase()
                    })
                  }
                  minLength="3"
                  maxLength="50"
                  pattern="[A-Z0-9_-]{3,50}"
                  required
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value
                    })
                  }
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: e.target.value
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.stockQuantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stockQuantity: e.target.value
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Low Stock Threshold</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.lowStockThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lowStockThreshold: e.target.value
                    })
                  }
                  required
                />
              </div>

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
          </div>
        </div>
      )}
    </div>
  );
}
