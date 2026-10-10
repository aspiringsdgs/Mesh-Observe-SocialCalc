-- Brings a local Postgres in line with server/src/db/schema.ts and the documented price.
-- Needed because upstream migration 0006 is not valid Postgres (so 0008 fails too) and
-- scripts/seed.ts seeds the rate as 3000000000.0 instead of 3e-12 USD/byte/day.
ALTER TABLE "uploads" ADD COLUMN IF NOT EXISTS "payment_chain" varchar(10) DEFAULT 'sol';
ALTER TABLE "uploads" ADD COLUMN IF NOT EXISTS "payment_token" varchar(10) DEFAULT 'SOL';
ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "payment_chain" varchar(10) DEFAULT 'sol';
ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "payment_token" varchar(10) DEFAULT 'SOL';
UPDATE config SET rate_per_byte_per_day = 3e-12 WHERE id = 1;
