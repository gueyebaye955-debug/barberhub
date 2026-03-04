# BarberHub Backend Setup

## 1) Install dependencies
```bash
npm install
```

## 2) Configure environment
Copy `.env.example` to `.env` and fill in your PostgreSQL credentials and JWT secret.

## 3) Create database
Create a PostgreSQL database named in `DB_NAME` (default: `barberhub`).

## 4) Run schema + seed
```bash
npm run db:setup
```

## 5) Start server
```bash
npm run dev
```

Server runs on `http://localhost:4000` by default.
