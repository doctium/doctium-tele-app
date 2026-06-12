-- Sequential human-friendly booking reference, starting at 100001.
-- Backfills existing appointments in creation order, then lets the
-- sequence take over for every new booking.

CREATE SEQUENCE "appointments_bookingNumber_seq" START WITH 100001;

ALTER TABLE "appointments" ADD COLUMN "bookingNumber" INTEGER;

-- Backfill existing rows in booking order so older bookings get lower numbers.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "appointments"
)
UPDATE "appointments" a
SET "bookingNumber" = 100000 + o.rn
FROM ordered o
WHERE a.id = o.id;

-- Continue numbering after the highest backfilled value (or at 100001 if empty).
SELECT setval(
  '"appointments_bookingNumber_seq"',
  COALESCE((SELECT MAX("bookingNumber") FROM "appointments"), 100000)
);

ALTER TABLE "appointments" ALTER COLUMN "bookingNumber" SET NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "bookingNumber" SET DEFAULT nextval('"appointments_bookingNumber_seq"');
ALTER SEQUENCE "appointments_bookingNumber_seq" OWNED BY "appointments"."bookingNumber";

CREATE UNIQUE INDEX "appointments_bookingNumber_key" ON "appointments"("bookingNumber");
