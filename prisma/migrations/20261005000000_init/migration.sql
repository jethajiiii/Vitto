-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "principalPaise" INTEGER NOT NULL,
    "annualRatePercent" DECIMAL(5,2) NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "disbursementDate" DATE NOT NULL,
    "emiPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Loan_principalPaise_positive" CHECK ("principalPaise" > 0),
    CONSTRAINT "Loan_tenureMonths_valid" CHECK ("tenureMonths" >= 3 AND "tenureMonths" <= 36)
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "principalDuePaise" INTEGER NOT NULL,
    "interestDuePaise" INTEGER NOT NULL,
    "principalPaidPaise" INTEGER NOT NULL DEFAULT 0,
    "interestPaidPaise" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Installment_principalPaid_valid" CHECK ("principalPaidPaise" >= 0 AND "principalPaidPaise" <= "principalDuePaise"),
    CONSTRAINT "Installment_interestPaid_valid" CHECK ("interestPaidPaise" >= 0 AND "interestPaidPaise" <= "interestDuePaise")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payment_amountPaise_positive" CHECK ("amountPaise" > 0)
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "interestPaise" INTEGER NOT NULL,
    "principalPaise" INTEGER NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentAllocation_interestPaise_non_negative" CHECK ("interestPaise" >= 0),
    CONSTRAINT "PaymentAllocation_principalPaise_non_negative" CHECK ("principalPaise" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "Installment_loanId_number_key" ON "Installment"("loanId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_loanId_idempotencyKey_key" ON "Payment"("loanId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
