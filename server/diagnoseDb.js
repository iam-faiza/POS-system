const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const Sale = require('./models/Sale');
const User = require('./models/User');

const MONGO_URI = 'mongodb://localhost:27017/pos-system';

async function checkDb() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected');

    // Check users to see their exact IDs and roles
    const users = await User.find({}, 'name email role').lean();
    console.log('Users in DB:', JSON.stringify(users, null, 2));

    // Check all sales with their timestamps and cashier IDs
    const sales = await Sale.find({}).lean();
    console.log('Total sales in DB:', sales.length);
    console.log('Sales details:', sales.map(s => ({
      id: s._id,
      invoice: s.invoiceNumber,
      cashier: s.cashier,
      total: s.total,
      createdAt: s.createdAt
    })));

    await mongoose.disconnect();
  } catch (err) {
    console.error('DB inspection error:', err);
  }
}

checkDb();