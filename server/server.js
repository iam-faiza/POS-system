const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const saleRoutes = require('./routes/saleRoutes');
const roleRoutes = require('./routes/roleRoutes');
const { corsOptionsForOrigins, getAllowedOrigins, validateJwtSecret } = require('./security/securityConfig');
const employeeRoutes = require('./routes/employeeRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const app = express();

// Set TRUST_PROXY=1 when deployed behind a reverse proxy so rate limiting sees real client IPs.
if (process.env.TRUST_PROXY) {
  const trust = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(trust) ? Number(trust) : trust === 'true' ? true : trust);
}

const allowedOrigins = getAllowedOrigins();
app.use(cors(corsOptionsForOrigins(allowedOrigins)));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/shifts', shiftRoutes);

const PORT = process.env.PORT || 5000;

async function startServer() {
  validateJwtSecret(process.env.JWT_SECRET);
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be configured before starting the server');
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

if (require.main === module) {
  startServer().catch(() => {
    console.error('Server startup failed; verify database and security configuration');
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
