const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const Sale = require('./models/Sale');
const User = require('./models/User');

const MONGO_URI = 'mongodb://localhost:27017/pos-system';

async function checkDb() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected');

    const customers = await Customer.find({}).lean();
    console.log('Total customers in DB:', customers.length);
    console.log('Customer samples:', JSON.stringify(customers.slice(0, 10), null, 2));

    // Check indexes
    const indexes = await Customer.collection.indexes();
    console.log('Customer indexes:', JSON.stringify(indexes, null, 2));

    // Check sales
    const salesCount = await Sale.countDocuments();
    console.log('Total sales in DB:', salesCount);

    // Check users
    const users = await User.find({}, 'name email role').lean();
    console.log('Users in DB:', JSON.stringify(users, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error('DB inspection error:', err);
  }
}

checkDb();
