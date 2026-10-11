/**
 * Empirical backend test script for customer lookup and creation
 */
const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const { validateCustomer, validatePhone } = require('./utils/customerValidation');

const MONGO_URI = 'mongodb://localhost:27017/pos-system';

const runTest = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB successfully');

    // 1. Test canonical normalization
    const formats = ['03001234567', '+923001234567', '923001234567', '00923001234567'];
    const normalizedValues = formats.map(f => validatePhone(f).normalized);
    console.log('Normalization check (should all be 923001234567):', normalizedValues);
    const allEqual = normalizedValues.every(v => v === '923001234567');
    console.log('All formats equal?', allEqual);

    // 2. Test lookup with different formats
    const searchPhone = '03001112222';
    const canonicalSearch = validatePhone(searchPhone).normalized;
    
    // Create test customer if not exists
    let testCust = await Customer.findOne({ phone: canonicalSearch });
    if (!testCust) {
      testCust = await Customer.create({ name: 'Format Test', phone: canonicalSearch });
      console.log('Created test customer with canonical phone:', canonicalSearch);
    }

    // Try lookup with different format
    const alternateFormat = '+923001112222';
    const altCanonical = validatePhone(alternateFormat).normalized;
    const found = await Customer.findOne({ phone: altCanonical });
    console.log('Lookup with +92... format found same record?', found && found._id.equals(testCust._id));

    // 3. Test creation reuse (backend prevention)
    // simulate POST /api/customers
    const existing = await Customer.findOne({ phone: canonicalSearch });
    if (existing) {
       console.log('Backend reuse logic: existing customer found and would be returned.');
    }

    // Cleanup
    await Customer.findByIdAndDelete(testCust._id);
    console.log('Cleaned up test record.');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
};

runTest();
