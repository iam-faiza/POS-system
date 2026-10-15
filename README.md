# RetailPOS — MERN Point of Sale System

A full-stack Point of Sale (POS) and inventory management application built with the **MERN stack**: MongoDB, Express, React, and Node.js. RetailPOS is designed for retail environments and includes role-based access control, inventory tracking, customer lookup, checkout, sales history, localization, and thermal receipt printing.

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Configure MongoDB Transactions](#configure-mongodb-transactions)
- [Run the Application](#run-the-application)
- [Seed Development Data](#seed-development-data)
- [Default Development URLs](#default-development-urls)
- [Roles and Permissions](#roles-and-permissions)
- [Testing and Production Build](#testing-and-production-build)
- [Security Notes](#security-notes)
- [Known Limitations](#known-limitations)
- [License](#license)

## Features

### Role-Based Access Control (RBAC)

- **Admin:** Access to dashboard analytics, products, categories, customers, sales history, stock adjustments, and audit information, subject to configured permissions.
- **Cashier:** Access to the POS checkout workflow, product search, customer lookup/registration, and personal sales history.
- **Additional roles:** Manager, Inventory Clerk, and custom roles may be available through the Roles page, depending on the application's current configuration.

### POS Terminal and Checkout

- Search products by barcode/SKU or name, with category filtering.
- Manage cart items with stock-limit validation.
- Calculate subtotals, taxes, discounts, cash tender, and change due on the server.
- Support cash and simulated card payments (Visa, Mastercard, Amex, and Other).
- Use MongoDB transactions to keep stock deductions, sale records, and customer totals consistent.
- Look up customers by phone number and register new customers during checkout.

### Inventory Management

- Create and update products.
- Archive products to help preserve historical sales records.
- Track stock adjustments and sales through stock movement records.
- Monitor low-stock products and dashboard alerts.
- Support bulk operations where enabled.

### Customer Management

- Find customers using normalized Pakistani phone formats, including `03xx...` and `923xx...`.
- Track customer purchase history and total spend.
- Preserve historical sale details using sale-time snapshots.
- Archive customers when appropriate rather than removing records needed for historical sales.

### Cashier Productivity

- Barcode scanner support through the focused product search field.
- Add a product by scanning its SKU or pressing Enter when there is a single matching result.
- Quick cash buttons for exact payment and convenient rounded amounts.
- Hold and resume orders; held carts can persist across page refreshes and are checked against current stock when resumed.
- Use toast notifications for feedback without disruptive browser alerts.

### Receipts, Localization, and Appearance

- Digital receipt modal with print-specific styling for 80 mm thermal printers.
- Multi-currency formatting: PKR, USD, EUR, GBP, AED, and SAR.
- English and Urdu (`اردو`) localization.
- Light and dark themes with persistent settings.

## Technology Stack

### Frontend

- React 19
- Vite 8
- Axios
- Lucide React

### Backend

- Node.js
- Express 5
- MongoDB and Mongoose 9
- JSON Web Tokens (JWT)
- bcryptjs

### Testing and Code Quality

- Node.js native test runner (`node --test`)
- Oxlint

## Project Structure

```text
Pos_system/
├── client/                  # React + Vite frontend
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── assets/          # Images and SVGs
│   │   ├── components/      # POS, dashboard, and management UI
│   │   ├── context/         # Theme, currency, and language settings
│   │   ├── services/        # API client and service helpers
│   │   ├── utils/           # Validation and localization helpers
│   │   ├── App.jsx          # Root application and navigation
│   │   └── main.jsx         # React entry point
│   ├── test/                # Frontend tests
│   ├── package.json
│   └── vite.config.js
├── server/                  # Express backend
│   ├── middleware/          # Authentication and authorization
│   ├── models/               # Mongoose models
│   ├── routes/               # REST API routes
│   ├── security/             # Security configuration
│   ├── services/             # Checkout and inventory services
│   ├── test/                 # Backend tests
│   ├── utils/                # Validation and helper functions
│   ├── seeder.js             # Development data seeder
│   ├── server.js             # Server entry point
│   └── package.json
└── README.md
```

> The exact folders and files may vary slightly as the project evolves.

## Prerequisites

Install the following on Ubuntu/Linux or another supported development environment:

- **Node.js:** v18 or later (use a version compatible with the dependencies)
- **npm:** v9 or later
- **MongoDB:** Local MongoDB Community Server configured as a replica set, or a MongoDB Atlas URI
- **Git:** Optional, if cloning the repository

## Installation

### 1. Open the project

If you already have the repository on your computer, open a terminal and navigate to the project directory. For example:

```bash
cd ~/Documents/sem-3/ds/Pos_system
```

If you are cloning the repository, use your repository URL:

```bash
git clone <your-repository-url>
cd Pos_system
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Install frontend dependencies

```bash
cd ../client
npm install
```

## Environment Variables

Create a `.env` file inside the `server/` directory. If the repository includes a `server/.env.example` file, use it as a template.

Example `server/.env`:

```dotenv
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/retail_pos?replicaSet=rs0
JWT_SECRET=replace_with_a_random_secret_at_least_32_characters_long
POS_TAX_RATE=5
POS_MAX_DISCOUNT_PERCENT=100
POS_TIME_ZONE=Asia/Karachi
```

Optional variables:

```dotenv
# Defaults to 30 days if not configured
JWT_EXPIRES_IN=12h

# Required in production when the app is configured to enforce allowed origins
CORS_ALLOWED_ORIGINS=https://your-pos-domain.com

# Set when deployed behind a trusted reverse proxy/load balancer
TRUST_PROXY=1
```

**Important:** Replace example secrets with secure values. Never commit `server/.env`, expose your JWT secret, or publish database credentials. Confirm the variable names against the backend configuration before deploying.

## Configure MongoDB Transactions

RetailPOS checkout relies on MongoDB transactions to keep stock updates, sale creation, and customer totals consistent. MongoDB transactions require a replica set or a supported sharded cluster; a standalone MongoDB server will not support this checkout flow.

### Option A: MongoDB Atlas

Use a MongoDB Atlas cluster and put its connection string in `MONGO_URI`. Ensure the database user, network access, and connection string are configured correctly.

### Option B: Local single-node replica set on Ubuntu

1. Open the MongoDB configuration file:

   ```bash
   sudo nano /etc/mongod.conf
   ```

2. Add or update the replication section (do not create a duplicate section):

   ```yaml
   replication:
     replSetName: rs0
   ```

3. Save the file, then restart MongoDB:

   ```bash
   sudo systemctl restart mongod
   sudo systemctl status mongod
   ```

4. Initialize the replica set once:

   ```bash
   mongosh --eval "rs.initiate()"
   ```

If the replica set was already initialized, MongoDB may report that it is already configured. Check its status with:

```bash
mongosh --eval "rs.status()"
```

Make sure the `MONGO_URI` includes `?replicaSet=rs0` when using this local setup.

## Run the Application

Start MongoDB first:

```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

Run the backend and frontend in **separate terminal windows**.

### Terminal 1 — Backend

```bash
cd ~/Documents/sem-3/ds/Pos_system/server
npm run dev
```

For production mode, use the start script instead:

```bash
npm start
```

The backend is expected at `http://localhost:5000`.

### Terminal 2 — Frontend

```bash
cd ~/Documents/sem-3/ds/Pos_system/client
npm run dev
```

Vite will print the local frontend URL in the terminal, typically `http://localhost:5173`.

## Seed Development Data

If the project includes a seeder and you want sample accounts, categories, and products, run this from the `server/` directory:

```bash
cd ~/Documents/sem-3/ds/Pos_system/server
node seeder.js
```

The development seeder may create the following sample accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin123` |
| Cashier | `cashier@example.com` | `cashier123` |

These credentials are for local development only. Change or remove seeded credentials before any public or production deployment. Check `seeder.js` to confirm the current seed data and whether running it again changes existing records.

## Default Development URLs

| Service | URL |
|---|---|
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:5000` |
| API base path | `http://localhost:5000/api` |

The actual frontend port may change if Vite selects another available port.

## Roles and Permissions

The application is designed around role-based access. Admin and Cashier are the primary documented roles. Manager, Inventory Clerk, and custom roles may be configured depending on the current backend permission definitions.

For the authoritative list of permissions, inspect the current role/permission configuration and the protected backend routes. Hiding a UI action alone is not sufficient authorization; protected operations must also be enforced by the server.

## Testing and Production Build

Run commands from the relevant directory.

### Backend tests

```bash
cd server
npm test
```

### Frontend tests

```bash
cd client
npm test
```

### Frontend production build

```bash
cd client
npm run build
```

The Vite production output is normally written to `client/dist/`.

If a test command is missing or behaves differently, check the `scripts` section in that directory's `package.json`. If configured, the project's GitHub Actions workflow can also run checks on pushes and pull requests.

## Security Notes

- Keep `.env` files and all secrets out of version control.
- Use a strong, unique `JWT_SECRET`.
- Seeded credentials are for local development only.
- Passwords should be hashed and never returned in API responses.
- Authentication and authorization should be enforced on the backend for every protected operation.
- Configure allowed CORS origins appropriately for production.
- Use HTTPS in production and configure trusted proxy settings only when appropriate.
- The in-memory login rate limiter, if used, resets when the server restarts and is not shared across multiple backend instances.

## Known Limitations

- Offline checkout is not supported; the application requires the backend and database to be available.
- The POS catalog may load all active products at once; server-side pagination may be needed for large inventories.
- Refunds and returns may not be implemented yet.
- In-memory rate limiting is not suitable for coordinated enforcement across multiple server instances without a shared store such as Redis.

Confirm these limitations against the current code before treating this list as exhaustive.

## License

No license has been specified. Unless a license is added to the repository, all rights remain with the author and reuse is not automatically granted.
