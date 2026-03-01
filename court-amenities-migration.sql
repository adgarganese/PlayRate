-- ============================================
-- COURT AMENITIES MIGRATION
-- Ensures amenities column exists as JSONB array for flexible amenity storage
-- ============================================

-- Step 1: Add amenities column if it doesn't exist
-- Using JSONB for flexible array storage (PostgreSQL native)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courts' AND column_name = 'amenities'
  ) THEN
    ALTER TABLE courts ADD COLUMN amenities JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Step 2: Create index for JSONB queries (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS idx_courts_amenities ON courts USING GIN (amenities);

-- Step 3: Migrate existing boolean fields to amenities array (if they exist)
-- This derives amenities from existing fields for backward compatibility
-- Note: This is a one-time migration. Future updates should use the amenities array directly.
DO $$
DECLARE
  court_record RECORD;
  amenity_list JSONB := '[]'::jsonb;
BEGIN
  FOR court_record IN SELECT id, has_lights, indoor, parking_type, surface_type FROM courts
  LOOP
    amenity_list := '[]'::jsonb;
    
    -- Add Lights if has_lights is true
    IF court_record.has_lights = true THEN
      amenity_list := amenity_list || '["Lights"]'::jsonb;
    END IF;
    
    -- Add Indoor/Outdoor
    IF court_record.indoor = true THEN
      amenity_list := amenity_list || '["Indoor"]'::jsonb;
    ELSIF court_record.indoor = false THEN
      amenity_list := amenity_list || '["Outdoor"]'::jsonb;
    END IF;
    
    -- Add Parking if exists
    IF court_record.parking_type IS NOT NULL AND court_record.parking_type != '' THEN
      amenity_list := amenity_list || jsonb_build_array('Parking: ' || court_record.parking_type);
    END IF;
    
    -- Add Surface if exists
    IF court_record.surface_type IS NOT NULL AND court_record.surface_type != '' THEN
      amenity_list := amenity_list || jsonb_build_array('Surface: ' || court_record.surface_type);
    END IF;
    
    -- Update only if amenities is empty/null and we have derived amenities
    IF jsonb_array_length(amenity_list) > 0 THEN
      UPDATE courts
      SET amenities = amenity_list
      WHERE id = court_record.id
        AND (amenities IS NULL OR amenities = '[]'::jsonb);
    END IF;
  END LOOP;
END $$;

-- Comments for documentation
COMMENT ON COLUMN courts.amenities IS 'Array of amenity strings (e.g., ["Lights", "Restrooms", "Water fountain"]) stored as JSONB';
