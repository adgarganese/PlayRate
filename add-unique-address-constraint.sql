-- Add unique constraint on courts.address to prevent duplicate addresses
-- Note: PostgreSQL UNIQUE constraints allow multiple NULL values, so courts with NULL addresses can coexist

-- Drop constraint/index if it exists (for idempotency)
DROP INDEX IF EXISTS public.courts_address_unique;
ALTER TABLE public.courts DROP CONSTRAINT IF EXISTS courts_address_unique;

-- Add unique index on address (allows multiple NULLs, but each non-null address must be unique)
-- Using CREATE UNIQUE INDEX with WHERE clause for partial uniqueness
CREATE UNIQUE INDEX courts_address_unique ON public.courts (LOWER(TRIM(address)))
WHERE address IS NOT NULL;
