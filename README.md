# Vitto — Loan Repayment & Servicing Engine

A production-ready loan repayment and servicing system built with Next.js 16 App Router, Prisma ORM, Neon PostgreSQL, and Firebase Authentication.

---

## 1. Deployed Application & Seeded Loans

- **Live URL**: [https://vitto-xi.vercel.app](https://vitto-xi.vercel.app)
- **Authentication**: Sign in using your Firebase test account to access the repayment schedule, test live payment allocations, and inspect real-time position calculations.

### Available Seeded Loans

| Label | Loan ID | Terms | What to Look For |
| :--- | :--- | :--- | :--- |
| **Fresh** | `6977683a-2e8e-4e74-9627-8c7cc52ccf57` | ₹1,00,000 &bull; 12% p.a. &bull; 6 months | Disbursed recently. Clean schedule, 0 payments, nothing overdue. |
| **Overdue** | `1d8bfb5a-a06c-458d-92aa-745da6d922c1` | ₹3,00,000 &bull; 15% p.a. &bull; 12 months | Inst #1 fully paid, Inst #2 partially paid & overdue, Inst #3 unpaid & overdue. |
| **Advance** | `32b8641c-8b5f-40f2-8daf-a96a6a598bb5` | ₹1,50,000 &bull; 12% p.a. &bull; 6 months | Single payment of 2.5× EMI settles Inst #1 & #2 completely, partially covers Inst #3. |

---

## 2. Architecture, Database & Hosting

- **Framework**: Next.js 16 (App Router, Server Components & Route Handlers)
- **Database**: PostgreSQL hosted on **Neon** (Serverless PostgreSQL with connection pooling)
- **ORM**: Prisma Client (`@prisma/client` with pooled `DATABASE_URL` and direct `DIRECT_URL`)
- **Hosting**: **Vercel** (Serverless Functions)
- **Authentication**: Firebase Authentication (Client SDK + Server-side RS256 token verification using Google's public x509 certs)
- **CI / CD**: GitHub Actions (`.github/workflows/ci.yml`) running migrations and full test suite on push/PR

---

## 3. Local Setup & Installation

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jethajiiii/Vitto.git
   cd Vitto
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Copy `.env.example` to `.env` and fill in your Neon database URLs and Firebase configuration:
   ```bash
   cp .env.example .env
   ```

4. **Run migrations and generate Prisma Client**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

5. **Seed the database**:
   ```bash
   node prisma/seed.js --force
   ```

6. **Start local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Running Tests

The test suite includes comprehensive unit tests for mathematical models, date handling, position calculation, waterfall payment allocation, and end-to-end integration tests:

```bash
# Run all unit and integration test suites
npm test

# Run unit tests only
npm run test:unit
```

---

## 5. API Reference

All endpoints require a valid Firebase ID token passed in the `Authorization: Bearer <token>` header.

### 1. Create Loan
- **Endpoint**: `POST /api/loans`
- **Request Body**:
  ```json
  {
    "principal": 100000,
    "annualRate": 12.0,
    "tenureMonths": 6,
    "disbursementDate": "2026-04-01"
  }
  ```
- **Response**: `201 Created` with full loan details, generated installment schedule, and initial position.

### 2. Get Loan & Position
- **Endpoint**: `GET /api/loans/:id?asOf=YYYY-MM-DD`
- **Query Param**: `asOf` (optional, defaults to current date in `Asia/Kolkata` timezone).
- **Response**: `200 OK` with loan terms, status of every installment (`PAID`, `PARTIAL`, `OVERDUE`, `UPCOMING`), and current position metrics (`outstandingPrincipal`, `outstandingTotal`, `overdueAmount`, `nextDue`).

### 3. Record Payment
- **Endpoint**: `POST /api/loans/:id/payments`
- **Headers**: `Idempotency-Key: <unique-string>`
- **Request Body**:
  ```json
  {
    "amount": 25000.00,
    "date": "2026-05-01"
  }
  ```
- **Response**: `201 Created` (or `200 OK` on idempotent replay) with payment allocation details and updated loan position.

---

## 6. Financial Domain Decisions

### Money Representation: Integer Paise
- **Decision**: All financial amounts throughout internal services, calculation engines, and database tables are represented strictly as **integer paise** (e.g., ₹1,000.50 = `100050` paise).
- **Rationale**: Prevents binary floating-point rounding errors inherent to IEEE 754 arithmetic (e.g., `0.1 + 0.2 !== 0.3`).
- **Conversion Boundary**: Amounts are received and returned as formatted 2-decimal rupee strings (e.g., `"1000.50"`) exclusively at the API controller boundary.

### Schedule Generation & Rounding Absorption
- **Monthly Interest Rate**: $r = \frac{\text{annualRate}}{12 \times 100}$
- **EMI Formula**: $\text{EMI} = \text{round}\left( P \times \frac{r \times (1+r)^n}{(1+r)^n - 1} \right)$
- **Interest Allocation**: $\text{Interest}_i = \text{round}(\text{Balance}_{i-1} \times r)$
- **Principal Allocation**: $\text{Principal}_i = \text{EMI} - \text{Interest}_i$ (for installments $1 \dots n-1$)
- **Final Installment Remainder Absorption**: On month $n$, $\text{Principal}_n = \text{Balance}_{n-1}$. This guarantees that the sum of all principal installments matches the disbursed principal amount down to the exact paise.
- **Calendar Clamping**: Due dates are calculated from the disbursement date clamped to the month's maximum calendar day (e.g., Jan 31 $\to$ Feb 28/29) without accumulating day drift.

### Payment Allocation (Waterfall Logic)
1. **Oldest Unsettled Installment First**: Sorted by installment number ascending.
2. **Interest Before Principal**: Within each installment, outstanding interest is settled before reducing principal.
3. **Partial Continuation**: Partially settled installments continue from their remaining unpaid balance.
4. **Overpayment Protection**: If payment amount exceeds the total remaining outstanding balance across all installments, the transaction is rejected with `422 AMOUNT_EXCEEDS_OUTSTANDING` before mutating any records.
5. **Concurrency & Idempotency**: Payment processing executes inside serializable transactions using `SELECT ... FOR UPDATE` row locks and unique `(loanId, idempotencyKey)` constraints to prevent double-charging or race conditions.

