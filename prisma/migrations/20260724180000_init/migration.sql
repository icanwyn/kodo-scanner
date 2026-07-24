-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('LONG', 'SHORT');
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE "ProcessGrade" AS ENUM ('A', 'B', 'C', 'D', 'F');

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScanSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filtersJson" TEXT NOT NULL,
    "regimeJson" TEXT NOT NULL,
    "resultsJson" TEXT NOT NULL,
    CONSTRAINT "ScanSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "timeframe" TEXT NOT NULL DEFAULT '1D',
    "setupType" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "stopPrice" DOUBLE PRECISION,
    "stopAtEntry" DOUBLE PRECISION,
    "targetPrices" TEXT,
    "exitPrice" DOUBLE PRECISION,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thesisSummary" TEXT,
    "notes" TEXT,
    "analysisJson" TEXT,
    "scanFactorsJson" TEXT,
    "entryAttribution" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Postmortem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "whatWentRight" TEXT,
    "whatWentWrong" TEXT,
    "emotions" TEXT,
    "processGrade" "ProcessGrade",
    "lessons" TEXT,
    "wouldRepeat" BOOLEAN,
    "bodyMarkdown" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Postmortem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WatchlistItem_symbol_key" ON "WatchlistItem"("symbol");
CREATE UNIQUE INDEX "Postmortem_tradeId_key" ON "Postmortem"("tradeId");
ALTER TABLE "Postmortem" ADD CONSTRAINT "Postmortem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
