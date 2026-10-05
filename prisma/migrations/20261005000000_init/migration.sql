-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "annual_rate" DOUBLE PRECISION NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "disbursement_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "loans_principal_positive" CHECK ("principal" > 0),
    CONSTRAINT "loans_annual_rate_positive" CHECK ("annual_rate" > 0),
    CONSTRAINT "loans_tenure_months_positive" CHECK ("tenure_months" > 0)
);

-- CreateTable
CREATE TABLE "instalments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "instalment_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_component" INTEGER NOT NULL,
    "interest_component" INTEGER NOT NULL,
    "total_due" INTEGER NOT NULL,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "instalments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "instalments_principal_component_non_negative" CHECK ("principal_component" >= 0),
    CONSTRAINT "instalments_interest_component_non_negative" CHECK ("interest_component" >= 0),
    CONSTRAINT "instalments_total_due_non_negative" CHECK ("total_due" >= 0),
    CONSTRAINT "instalments_amount_paid_non_negative" CHECK ("amount_paid" >= 0),
    CONSTRAINT "instalments_amount_paid_le_total_due" CHECK ("amount_paid" <= "total_due")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_date" DATE NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "instalments_loan_id_instalment_number_key" ON "instalments"("loan_id", "instalment_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_loan_id_idempotency_key_key" ON "payments"("loan_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "instalments" ADD CONSTRAINT "instalments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
