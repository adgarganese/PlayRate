-- Allow four additional basketball attributes in cosigns.attribute so they can be cosigned like the existing ones.
-- Frontend (lib/recap.ts) maps: Dribbling, Perimeter Defense, Playmaking, Post Defense -> slugs used here.

ALTER TABLE cosigns
  DROP CONSTRAINT IF EXISTS cosigns_attribute_check;

ALTER TABLE cosigns
  ADD CONSTRAINT cosigns_attribute_check CHECK (attribute IN (
    'shooting', 'handles', 'finishing', 'defense', 'iq', 'passing',
    'rebounding', 'hustle', 'athleticism', 'leadership',
    'dribbling', 'perimeter-defense', 'playmaking', 'post-defense'
  ));
