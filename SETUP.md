# Stencil OMS — MERN Backend

## Quick Start

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and paste your MongoDB Atlas connection string
```

### 3. Seed the database (creates roles + admin user)
```bash
npm run seed
```

### 4. Start the server
```bash
npm run dev      # development (auto-restart)
npm start        # production
```

Server runs at: `http://localhost:5000`

---

## Default Login
| Field    | Value         |
|----------|---------------|
| username | `admin`       |
| password | `admin123`    |

> ⚠️ Change the password immediately after first login.

---

## API Reference

### Auth
| Method | Endpoint                    | Description          |
|--------|-----------------------------|----------------------|
| POST   | /api/auth/login             | Login → get JWT      |
| GET    | /api/auth/me                | Get current user     |
| POST   | /api/auth/change-password   | Change own password  |
| POST   | /api/auth/refresh           | Refresh token        |

### Orders
| Method | Endpoint                    | Permission           |
|--------|-----------------------------|----------------------|
| GET    | /api/orders                 | viewAllOrders        |
| GET    | /api/orders/:id             | viewAllOrders        |
| POST   | /api/orders                 | createOrder          |
| PUT    | /api/orders/:id             | editOrder            |
| PATCH  | /api/orders/:id/status      | logisticsUpdate      |
| PATCH  | /api/orders/:id/eta         | editOrder            |
| POST   | /api/orders/:id/comment     | viewAllOrders        |
| PATCH  | /api/orders/:id/grn         | raiseGrn             |
| PATCH  | /api/orders/:id/billing     | purchaseOrder        |
| PATCH  | /api/orders/:id/delivery    | deliver              |
| POST   | /api/orders/:id/split       | editOrder            |
| GET    | /api/orders/:id/trail       | viewAllOrders        |
| DELETE | /api/orders/:id             | deleteOrder          |

### Dashboard
All require `viewAllOrders` permission.

| Method | Endpoint                         | Description              |
|--------|----------------------------------|--------------------------|
| GET    | /api/dashboard/summary           | Key stats counts         |
| GET    | /api/dashboard/pipeline          | Orders by stage          |
| GET    | /api/dashboard/recent-orders     | Latest 50 orders         |
| GET    | /api/dashboard/due-orders        | Overdue / today / week   |
| GET    | /api/dashboard/purchased         | Today/yesterday purchases|
| GET    | /api/dashboard/lr-at-transporter | In Transit orders        |
| GET    | /api/dashboard/eta-edited        | ETA-edited orders        |
| GET    | /api/dashboard/dealer-summary    | Per-dealer analytics     |
| GET    | /api/dashboard/supplier-summary  | Per-supplier analytics   |

### Pending DONs
| Method | Endpoint              | Permission   |
|--------|-----------------------|--------------|
| GET    | /api/dons             | viewPendingDon |
| PATCH  | /api/dons/:id/approve | approve      |

### Pending SPOs
| Method | Endpoint                 | Permission    |
|--------|--------------------------|---------------|
| GET    | /api/spos                | viewPendingSpo |
| PATCH  | /api/spos/:id/raise-po   | raisePo       |

### Shipments
| Method | Endpoint                       | Permission       |
|--------|--------------------------------|------------------|
| GET    | /api/shipments                 | viewShipments    |
| PATCH  | /api/shipments/:id/dispatch    | logisticsUpdate  |
| PATCH  | /api/shipments/:id/arrived     | transitUpdate    |

### GRNs
| Method | Endpoint                   | Permission    |
|--------|----------------------------|---------------|
| GET    | /api/grns                  | viewAllOrders |
| PATCH  | /api/grns/:id              | raiseGrn      |
| PATCH  | /api/grns/:id/purchase     | purchaseOrder |

### Masters (Customers / Suppliers / Products / Transporters)
Same pattern for `/api/customers`, `/api/suppliers`, `/api/products`, `/api/transporters`:

| Method | Endpoint    | Permission  |
|--------|-------------|-------------|
| GET    | /           | viewMaster  |
| GET    | /:id        | viewMaster  |
| POST   | /           | editMaster  |
| PUT    | /:id        | editMaster  |
| DELETE | /:id        | editMaster  |

### Permissions
| Method | Endpoint                          | Role Required         |
|--------|-----------------------------------|-----------------------|
| GET    | /api/permissions/matrix           | any logged-in         |
| GET    | /api/permissions/all-keys         | any logged-in         |
| GET    | /api/permissions/roles            | any logged-in         |
| GET    | /api/permissions/roles/:name      | any logged-in         |
| POST   | /api/permissions/roles            | admin+                |
| PUT    | /api/permissions/roles/:name      | admin+                |
| PATCH  | /api/permissions/roles/:name/toggle | admin+              |
| DELETE | /api/permissions/roles/:name      | superadmin only       |

### Users
| Method | Endpoint                         | Role Required  |
|--------|----------------------------------|----------------|
| GET    | /api/users                       | admin+         |
| GET    | /api/users/:id                   | admin+         |
| POST   | /api/users                       | admin+         |
| PUT    | /api/users/:id                   | admin+         |
| DELETE | /api/users/:id                   | admin+         |
| PATCH  | /api/users/:id/reset-password    | admin+         |
| PATCH  | /api/users/:id/permissions       | admin+         |
| POST   | /api/users/copy-permissions      | admin+         |

### Reports / Export
| Method | Endpoint                            | Permission     |
|--------|-------------------------------------|----------------|
| GET    | /api/reports/orders                 | viewReports    |
| GET    | /api/reports/orders/export          | exportReports  |
| GET    | /api/reports/eta-edited/export      | exportReports  |
| GET    | /api/reports/dealer-summary/export  | exportReports  |

---

## Authentication
All endpoints (except `/api/auth/login`) require:
```
Authorization: Bearer <your_jwt_token>
```

---

## Project Structure
```
backend/
├── server.js               # Entry point
├── .env.example            # Environment template
├── package.json
├── config/
│   └── db.js               # MongoDB connection
├── models/
│   ├── User.js
│   ├── Order.js            # Main order + trail + ETA history
│   ├── Customer.js
│   ├── Supplier.js
│   ├── Product.js
│   ├── Transporter.js
│   └── Role.js
├── controllers/
│   ├── auth.controller.js
│   ├── order.controller.js
│   ├── user.controller.js
│   ├── dashboard.controller.js
│   ├── report.controller.js
│   ├── permission.controller.js
│   └── master.controller.js
├── routes/
│   ├── auth.routes.js
│   ├── order.routes.js
│   ├── user.routes.js
│   ├── dashboard.routes.js
│   ├── report.routes.js
│   ├── permission.routes.js
│   ├── don.routes.js
│   ├── spo.routes.js
│   ├── grn.routes.js
│   ├── shipment.routes.js
│   ├── customer.routes.js
│   ├── supplier.routes.js
│   ├── product.routes.js
│   └── transporter.routes.js
├── middleware/
│   ├── auth.middleware.js      # JWT protect + restrictTo
│   ├── permission.middleware.js # Granular can() checks
│   └── error.middleware.js
└── utils/
    └── seed.js                 # DB seed script
```
