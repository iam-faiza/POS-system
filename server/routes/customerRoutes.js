const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const { protect } = require('../middleware/authMiddleware');
const { validateCustomer, validatePhone } = require('../utils/customerValidation');

// Lookup customer by phone (normalized)
router.get('/lookup', protect, async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone parameter is required' });
    }

    const phoneValidation = validatePhone(phone);
    if (phoneValidation.error) {
      return res.status(400).json({ message: phoneValidation.error });
    }

    const normalizedPhone = phoneValidation.normalized;
    const customer = await Customer.findOne({ phone: normalizedPhone });

    if (customer) {
      return res.json({ found: true, customer });
    } else {
      return res.json({ found: false, normalizedPhone });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all customers (with optional search by name or phone)
router.get('/', protect, async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search && String(search).trim() !== '') {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      query = {
        $or: [
          { name: searchRegex },
          { phone: searchRegex }
        ]
      };
    }

    const customers = await Customer.find(query).sort({ name: 1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new customer with full validation, normalization, and duplicate prevention
router.post('/', protect, async (req, res) => {
  const validation = validateCustomer(req.body);

  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  try {
    const { name, phone, email, marketingConsent } = validation.data;

    // Check if customer with same normalized phone already exists (backend duplicate prevention)
    const existingCustomer = await Customer.findOne({ phone });
    if (existingCustomer) {
      return res.status(400).json({ message: 'A customer with this phone number already exists', customer: existingCustomer });
    }

    const customer = new Customer({ name, phone, email, marketingConsent });
    const created = await customer.save();
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update an existing customer
router.put('/:id', protect, async (req, res) => {
  const validation = validateCustomer(req.body);

  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  try {
    const { name, phone, email, marketingConsent } = validation.data;

    // Check if another customer already uses this phone number
    const existingWithPhone = await Customer.findOne({ phone, _id: { $ne: req.params.id } });
    if (existingWithPhone) {
      return res.status(400).json({ message: 'Phone number already belongs to another customer' });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      { name, phone, email, marketingConsent },
      { new: true, runValidators: true }
    );

    if (!updatedCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(updatedCustomer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete or safely archive a customer
router.delete('/:id', protect, async (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if customer has historical sales
    const salesCount = await Sale.countDocuments({ customer: customerId });

    if (salesCount > 0) {
      // Historical sales exist: perform safe deactivation/archive rather than breaking sale references
      // Or if name doesn't already indicate archived, rename/tag or keep safe
      customer.name = `${customer.name} (Archived)`;
      customer.phone = `archived_${Date.now()}_${customer.phone}`;
      await customer.save();
      return res.json({
        message: `Customer has ${salesCount} historical sales. Safely archived customer to preserve sales records.`,
        archived: true
      });
    }

    // No historical sales: safe to permanently delete
    await Customer.findByIdAndDelete(customerId);
    res.json({ message: 'Customer deleted successfully', deleted: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
