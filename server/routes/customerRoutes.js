const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const { protect, admin } = require('../middleware/authMiddleware');
const { validateCustomer, validatePhone } = require('../utils/customerValidation');

// Lookup customer by phone (normalized)
// accessible by both Admin and Cashier
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
    
    // Find matching customer using canonical phone
    // If multiple exist (legacy duplicates), return the most recent one
    const customers = await Customer.find({ phone: normalizedPhone }).sort({ createdAt: -1 });

    if (customers.length > 0) {
      return res.json({ 
        found: true, 
        customer: customers[0],
        duplicateWarning: customers.length > 1 ? `Warning: ${customers.length} records found with this phone. Using most recent.` : undefined
      });
    } else {
      return res.json({ found: false, normalizedPhone });
    }
  } catch (error) {
    console.error('Lookup Error:', error);
    res.status(500).json({ message: 'Internal server error during lookup' });
  }
});

// Get all ACTIVE customers (with optional search across name, phone, email)
router.get('/', protect, async (req, res) => {
  try {
    const { search } = req.query;
    // Only return non-archived customers
    let query = { isArchived: { $ne: true } };

    if (search && String(search).trim() !== '') {
      const s = String(search).trim();
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      const orConditions = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ];

      // If search input matches or resembles phone format, search normalized phone as well
      const pVal = validatePhone(s);
      if (!pVal.error && pVal.normalized) {
        orConditions.push({ phone: pVal.normalized });
      } else {
        const digits = s.replace(/\D/g, '');
        if (digits.length >= 3) {
          let normDigits = digits;
          if (normDigits.startsWith('0')) normDigits = '92' + normDigits.slice(1);
          orConditions.push({ phone: new RegExp(normDigits, 'i') });
        }
      }

      query = { isArchived: { $ne: true }, $or: orConditions };
    }

    const customers = await Customer.find(query).sort({ name: 1 }).limit(100);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all ARCHIVED customers (with optional search) - Admin only
router.get('/archived', protect, admin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = { isArchived: true };

    if (search && String(search).trim() !== '') {
      const s = String(search).trim();
      const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');

      query = {
        isArchived: true,
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { email: searchRegex }
        ]
      };
    }

    const customers = await Customer.find(query).sort({ updatedAt: -1 }).limit(100);
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new customer or reuse existing one (Duplicate Prevention)
router.post('/', protect, async (req, res) => {
  const validation = validateCustomer(req.body);

  if (validation.error) {
    return res.status(400).json({ message: validation.error });
  }

  try {
    const { name, phone, email, marketingConsent } = validation.data;

    // Backend duplicate prevention (atomic lookup-or-create simulation)
    const existingCustomer = await Customer.findOne({ phone });
    if (existingCustomer) {
      // Requirements: "If a matching customer exists, reuse and return the existing customer record"
      return res.status(200).json(existingCustomer); 
    }

    const customer = new Customer({ name, phone, email, marketingConsent });
    const created = await customer.save();
    res.status(201).json(created);
  } catch (error) {
    // Handle rare race condition if unique index is added later
    if (error.code === 11000) {
       const existing = await Customer.findOne({ phone: validation.data.phone });
       return res.status(200).json(existing);
    }
    res.status(400).json({ message: error.message });
  }
});

// Update an existing customer (Admin Only)
router.put('/:id', protect, admin, async (req, res) => {
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

// Bulk delete/archive customers (Admin Only)
// Preserves historical sales records by archiving customers that have sales,
// while permanently deleting customers with no sales history.

// Restore an archived customer (Admin only)
router.patch('/:id/restore', protect, admin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    if (!customer.isArchived) {
      return res.status(400).json({ message: 'Customer is not archived' });
    }

    // Restore: clear archived flag
    customer.isArchived = false;

    // If name has the "(Archived)" suffix appended during archival, strip it
    if (customer.name.endsWith(' (Archived)')) {
      customer.name = customer.name.slice(0, -' (Archived)'.length);
    }

    // If phone was prefixed during archival, strip the prefix
    if (customer.phone.startsWith('archived_')) {
      // format: archived_<timestamp>_<originalPhone>
      const parts = customer.phone.split('_');
      // parts[0] = 'archived', parts[1] = timestamp, rest = original phone
      if (parts.length >= 3) {
        customer.phone = parts.slice(2).join('_');
      }
    }

    await customer.save();
    res.json({ message: 'Customer restored successfully', customer });
  } catch (error) {
    res.status(500).json({ message: 'Error restoring customer: ' + error.message });
  }
});

router.delete('/', protect, admin, async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    if (totalCustomers === 0) {
      return res.json({
        message: 'No customers found to delete.',
        deletedCount: 0,
        archivedCount: 0,
        totalProcessed: 0
      });
    }

    // Find all customer IDs referenced in existing sales
    const salesWithCustomer = await Sale.distinct('customer');
    const referencedIds = salesWithCustomer.filter(id => id != null);

    // 1. Permanently delete customers with NO historical sales
    const deleteResult = await Customer.deleteMany({ _id: { $nin: referencedIds } });
    const deletedCount = deleteResult.deletedCount || 0;

    // 2. Safely archive remaining customers with historical sales
    let archivedCount = 0;
    if (referencedIds.length > 0) {
      const customersToArchive = await Customer.find({
        _id: { $in: referencedIds },
        isArchived: { $ne: true }
      });

      for (const cust of customersToArchive) {
        if (!cust.name.includes('(Archived)')) {
          cust.name = `${cust.name} (Archived)`;
        }
        if (!cust.phone.startsWith('archived_')) {
          cust.phone = `archived_${Date.now()}_${cust.phone}`;
        }
        cust.isArchived = true;
        await cust.save();
        archivedCount++;
      }
    }

    res.json({
      message: `Bulk operation completed: ${deletedCount} deleted, ${archivedCount} preserved/archived for historical sales.`,
      deletedCount,
      archivedCount,
      totalProcessed: totalCustomers
    });
  } catch (error) {
    console.error('Bulk customer delete error:', error);
    res.status(500).json({ message: 'Error processing bulk customer deletion: ' + error.message });
  }
});

// Delete or safely archive an individual customer (Admin Only)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const customerId = req.params.id;
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if customer has historical sales
    const salesCount = await Sale.countDocuments({ customer: customerId });

    if (salesCount > 0) {
      // Historical sales exist: Safe archive
      // We rename phone to free it up for potential new registration if needed,
      // but keep the ID for historical references.
      if (!customer.name.includes('(Archived)')) {
        customer.name = `${customer.name} (Archived)`;
      }
      if (!customer.phone.startsWith('archived_')) {
        customer.phone = `archived_${Date.now()}_${customer.phone}`;
      }
      customer.isArchived = true;
      await customer.save();

      return res.json({
        message: `Customer has ${salesCount} historical sales. Safely archived customer to preserve sales records.`,
        archived: true
      });
    }

    // No historical sales: Safe to permanently delete
    await Customer.findByIdAndDelete(customerId);
    res.json({ message: 'Customer deleted successfully', deleted: true });
  } catch (error) {
    res.status(500).json({ message: 'Error during deletion/archival: ' + error.message });
  }
});

module.exports = router;
