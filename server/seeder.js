const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding');

    // Clear existing data
    await User.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();

    // Create Admin User
    const adminPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin'
    });

    // Create Cashier User
    const cashierPassword = await bcrypt.hash('cashier123', 10);
    await User.create({
      name: 'Cashier User',
      email: 'cashier@example.com',
      password: cashierPassword,
      role: 'cashier'
    });

    // Create Sample Categories
    const cat1 = await Category.create({ name: 'Electronics' });
    const cat2 = await Category.create({ name: 'Groceries' });

    // Create Sample Products
    await Product.create({
      name: 'Mouse',
      sku: 'M001',
      category: cat1._id,
      price: 20,
      stockQuantity: 50,
      lowStockThreshold: 10
    });

    await Product.create({
      name: 'Keyboard',
      sku: 'K001',
      category: cat1._id,
      price: 45,
      stockQuantity: 30,
      lowStockThreshold: 5
    });

    await Product.create({
      name: 'Bread',
      sku: 'B001',
      category: cat2._id,
      price: 2.5,
      stockQuantity: 100,
      lowStockThreshold: 20
    });

    console.log('Data Seeded Successfully');
    process.exit();
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
};

seedData();
