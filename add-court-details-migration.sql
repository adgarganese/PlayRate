-- Migration: Add detailed court information fields
-- Description: Adds fields for indoor/outdoor, hoop count, court type, surface, lights, cost, hours, parking, amenities, and notes
-- Date: 2024

-- Add new columns to courts table
ALTER TABLE courts 
ADD COLUMN IF NOT EXISTS indoor BOOLEAN,
ADD COLUMN IF NOT EXISTS hoop_count INTEGER,
ADD COLUMN IF NOT EXISTS court_type TEXT, -- 'Full', 'Half', 'Both'
ADD COLUMN IF NOT EXISTS surface_type TEXT, -- 'Hardwood', 'Asphalt', 'Sport court', etc.
ADD COLUMN IF NOT EXISTS has_lights BOOLEAN,
ADD COLUMN IF NOT EXISTS cost TEXT, -- 'Free', 'Paid', or specific cost
ADD COLUMN IF NOT EXISTS hours TEXT, -- Opening hours (e.g., "6am - 10pm" or "24/7")
ADD COLUMN IF NOT EXISTS parking_type TEXT, -- 'Street', 'Lot', 'None'
ADD COLUMN IF NOT EXISTS amenities TEXT[], -- Array of amenities like ['Water fountain', 'Restrooms', 'Benches']
ADD COLUMN IF NOT EXISTS notes TEXT; -- General notes/rules about the court

-- Add comments for documentation
COMMENT ON COLUMN courts.indoor IS 'Whether the court is indoor or outdoor';
COMMENT ON COLUMN courts.hoop_count IS 'Number of basketball hoops/courts';
COMMENT ON COLUMN courts.court_type IS 'Type of court: Full, Half, or Both';
COMMENT ON COLUMN courts.surface_type IS 'Court surface material (Hardwood, Asphalt, Sport court, etc.)';
COMMENT ON COLUMN courts.has_lights IS 'Whether the court has lighting for night play';
COMMENT ON COLUMN courts.cost IS 'Cost to use the court (Free, Paid, or specific amount)';
COMMENT ON COLUMN courts.hours IS 'Operating hours of the court';
COMMENT ON COLUMN courts.parking_type IS 'Type of parking available (Street, Lot, None)';
COMMENT ON COLUMN courts.amenities IS 'Array of available amenities';
COMMENT ON COLUMN courts.notes IS 'Additional notes or rules about the court';
