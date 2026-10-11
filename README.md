# RetailPOS - MERN Point of Sale System

A robust, full-stack Point of Sale (POS) and inventory management web application built with the **MERN** stack (MongoDB, Express, React, Node.js). Designed for retail environments, this system features role-based access control, atomic inventory transactions, multi-currency support, bilingual (English/Urdu) localization, and thermal receipt printing capabilities.

---

## Key Features

- **Role-Based Access Control (RBAC)**:
  - **Admin**: Full access to dashboard analytics, product management, category management, customer database, sales history, stock adjustments, and audit logs.
  - **Cashier**: Streamlined POS terminal access for processing sales, managing cart items, customer phone lookup/registration, and viewing personal sales history.
- **POS Terminal & Checkout**:
  - Barcode/SKU and name-based product search with category filtering.
  - Real-time cart management with stock limit validation.
  - Server-side calculation of subtotals, configurable taxes, discounts, cash tenders, and change due.
  - Support for Cash and simulated Card payments (Visa, Mastercard, Amex, Other).
  - Atomic MongoDB transactions ensuring stock deduction, sale recording, and customer spend accumulation happen reliably without race conditions.
- **Inventory & Stock Management**:
  - Product creation, updates, soft-deletion/archival (protecting historical sales), and bulk delete operations.
  - Stock audit trail via `StockMovement` tracking for every adjustment and sale.
  - Low stock monitoring and dashboard alerts.
- **Customer Loyalty & Lookup**:
  - Instant customer lookup by phone number with Pakistani phone format normalization (`03xx` and `923xx`).
  - Customer purchase history and total spend tracking.
- **Receipt Generation & Thermal Printing**:
  - Professional digital receipt modal with dedicated `@media print` CSS layout sized for 80mm thermal printers.
- **Localization & Theme Customization**:
  - Multi-currency support (PKR, USD, EUR, GBP, AED, SAR) with built-in formatting.
  - Bilingual localization (English and Urdu / اردو).
  - Dark and Light mode toggle with persistent state.

---

## Technology Stack

- **Frontend**:
  - React 19 (SPA)
  - Vite 8
  - Lucide React (Icons)
  - Axios
- **Backend**:
  - Node.js & Express 5.x
  - Mongoose 9.x (MongoDB)
  - JSON Web Tokens (JWT) for authentication
  - bcryptjs for password hashing
- **Testing & Quality**:
  - Node.js native test runner (`node --test`)
  - Oxlint

---

## Project Folder Structure

```text
Pos_system/
├── client/                 # Frontend React application
│   ├── public/             # Static assets and icons
│   ├── src/
│   │   ├── assets/         # Images and SVGs
│   │   ├── components/     # UI components (PosTerminal, Dashboard, ProductsManager, etc.)
│   │   ├── context/        # SettingsContext (Theme, Currency, Language)
│   │   ├── services/       # Axios API client
│   │   ├── utils/          # Client-side validation & i18n
│   │   ├── App.jsx         # Root component & tab router
│   │   └── main.jsx        # React entry point
│   ├── test/               # Client unit tests
│   ├── package.json
│   └── vite.config.js
├── server/                 # Backend Express application
│   ├── middleware/         # Auth and role protection middleware
│   ├── models/             # Mongoose schemas (User, Product, Category, Customer, Sale, StockMovement)
│   ├── routes/             # REST API routes (auth, products, categories, customers, sales)
│   ├── security/           # Rate limiting and CORS configuration
│   ├── services/           # Checkout and inventory transaction services
│   ├── test/               # Comprehensive backend test suite
│   ├── utils/              # Server-side validation and helper utilities
│   ├── seeder.js           # Database seeding script
│   ├── server.js           # Express server and MongoDB connection
│   └── package.json
└── README.md
```

---

## Prerequisites

Ensure the following tools are installed on your Ubuntu/Linux system:
- **Node.js** (v18+ recommended)
- **npm** (v9+)
- **MongoDB** (Local community edition or MongoDB Atlas URI)

---

## Installation and Setup Instructions for Ubuntu / Linux

1. **Clone or Open the Repository**:
   Navigate to your project root folder:
   ```bash
   cd ~/Documents/sem-3/ds/Pos_system
   ```

2. **Install Backend Dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Install Frontend Dependencies**:
   ```bash
   cd ../client
   npm install
   ```

---

## Environment Variables

Create a `.env` file inside the `server/` directory. You can use `.env.example` as a template.

### `server/.env` Example:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/retail_pos
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
POS_TAX_RATE=5
POS_MAX_DISCOUNT_PERCENT=100
```

> **Note**: Never commit your `.env` file or expose your `JWT_SECRET` and `MONGO_URI`.

---

## How to Start MongoDB, Backend, and Frontend

### 1. Start MongoDB
If using local MongoDB on Ubuntu:
```bash
sudo systemctl start mongod
```
Verify MongoDB is running:
```bash
sudo systemctl status mongod
```

### 2. Seed Database (Optional - Recommended for First-Time Setup)
To populate default admin and cashier accounts along with sample categories and products:
```bash
cd server
node seeder.js
```
*(Default seeded logins: Admin `admin@example.com` / `admin123`, Cashier `cashier@example.com` / `cashier`)*

### 3. Start the Backend Server
```bash
cd server
npm run dev
# Or production mode: npm start
```
The backend server will run on `http://localhost:5000`.

### 4. Start the Frontend Development Server
Open a new terminal window:
```bash
cd ~/Documents/sem-3/ds/Pos_system/client
npm run dev
```
The Vite development server will run on `http://localhost:5173`.

---

## Default Development URLs

- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api`

---

## Authentication & Default Roles

The system supports two user roles:
1. **Admin**:
   - Email: `admin@example.com`
   - Password: `admin123`
   - Capabilities: Full dashboard analytics, inventory management, category management, customer database, sales history, stock audit trails.
2. **Cashier**:
   - Email: `cashier@example.com`
   - Password: `cashier123`
   - Capabilities: POS checkout terminal, product search, customer lookup/registration, and personal sales history.

---

## Running Tests and Building the Frontend

### Backend Tests
Runs the full test suite (50+ tests covering checkout validation, transactions, security, permissions, and filters):
```bash
cd server
npm test
```

### Frontend Tests
Runs client-side utility and validation tests using Node's native test runner:
```bash
cd client
npm test
```

### Frontend Production Build
Bundles the React application for production into `client/dist/`:
```bash
cd client
npm run build
```

---

## Screenshots

*(Placeholders)*
- **Login Screen**: Clean authentication interface with role credentials helper.
- **POS Terminal**: Product catalog grid with category filters, cart summary, customer lookup, and payment modal.
- **Admin Dashboard**: Revenue overview, sales count, and low stock product alerts.
- **Sales History**: Filterable list of past transactions with invoice details and thermal receipt modal.

---

## Security Notes

- **Secrets Management**: Keep `.env` files out of version control.
- **JWT Security**: Tokens are signed using HS256 with strict expiration and validated against database user records on every protected request.
- **Password Security**: Passwords are securely hashed with `bcryptjs` and never exposed in API responses.
- **Rate Limiting**: Login endpoints include in-memory rate limiting to prevent brute-force attacks.

---

## Current Limitations & Future Improvements

- **In-Memory Rate Limiter**: Login rate limiting resets on server restart; future scaling across multiple instances should use Redis.
- **Offline Mode**: Currently requires an active connection to MongoDB.

---

## License

No license has been specified for this project. All rights reserved by the author.
