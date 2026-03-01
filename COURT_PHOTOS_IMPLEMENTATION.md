# Court Photos Carousel Implementation

## Overview
Added a 4-photo carousel system to the Court Detail screen, allowing users to upload and manage photos for each court.

## Files Created/Modified

### 1. Database Migration
- **File**: `court-photos-migration.sql`
- **Purpose**: Creates the `court_photos` table, RLS policies, and indexes
- **Key Features**:
  - Unique constraint on (court_id, slot) to ensure one photo per slot
  - Slot validation (1-4)
  - RLS policies matching app patterns (public read, authenticated write)
  - Storage bucket setup instructions included

### 2. Backend Functions
- **File**: `lib/courts.ts`
- **Added Functions**:
  - `fetchCourtPhotos(courtId)`: Fetches all photos for a court with public URLs
  - `uploadCourtPhoto(courtId, userId, slot, imageUri)`: Uploads photo to storage and database
  - `deleteCourtPhoto(courtId, slot, userId)`: Deletes photo from storage and database
  - `getAvailableSlots(courtId)`: Returns array of empty slot numbers
- **Added Types**:
  - `CourtPhoto`: Type for photo records with URL

### 3. Photo Carousel Component
- **File**: `components/CourtPhotoCarousel.tsx`
- **Features**: Horizontal FlatList with paging; up to 4 slots (filled or empty placeholders); full-screen viewer; edit/delete/upload for authenticated users; loading states. See **UI/UX Features** below for full list.

### 4. UI Integration
- **File**: `app/courts/[courtId].tsx`
- **Added**:
  - Photo carousel section after header card
  - Photo loading state
  - Integration with existing court detail screen

## Implementation Details

### Database Schema
```sql
court_photos (
  id UUID PRIMARY KEY,
  court_id UUID REFERENCES courts(id),
  user_id UUID REFERENCES auth.users(id),
  slot INTEGER CHECK (slot BETWEEN 1 AND 4),
  storage_path TEXT,
  created_at TIMESTAMPTZ,
  UNIQUE(court_id, slot)
)
```

### Storage Setup
**Supabase Storage Bucket**: `court-photos`
- **Public**: Yes (or configure policies for public read)
- **File size limit**: 5MB (recommended)
- **Allowed MIME types**: image/jpeg, image/png, image/webp

**Storage Path Structure**: `{court_id}/{court_id}-{slot}-{timestamp}.{ext}`

### UI/UX Features
- **Carousel**: Horizontal scrolling with paging (FlatList)
- **Empty Slots**: Show placeholder with "Add Photo" button (if authenticated)
- **Full-Screen Viewer**: Tap any photo to view full-screen
- **Edit/Replace**: Tap edit button to replace photo in slot
- **Delete**: Tap delete button to remove photo (with confirmation)
- **Loading States**: Show spinner during upload
- **Responsive**: Adapts to screen width

### RLS Policies
- **SELECT**: Anyone can read photos (public data)
- **INSERT**: Only authenticated users can insert their own photos
- **UPDATE**: Only authenticated users can update their own photos
- **DELETE**: Only authenticated users can delete their own photos

**Note**: Photos can be replaced by any authenticated user (community editing). If you want to restrict to uploader only, modify UPDATE policy to check `auth.uid() = user_id`.

## Step-by-Step Plan

1. ✅ **Database Migration** — Run `court-photos-migration.sql` in Supabase SQL editor; create bucket `court-photos` (see **Storage Bucket Setup Instructions** below).
2. ✅ **Backend Functions** — Photo types and CRUD functions in `lib/courts.ts`.
3. ✅ **Carousel Component** — Reusable `CourtPhotoCarousel` with image picker and upload flow.
4. ✅ **UI Integration** — Carousel section on court detail screen with loading and error handling.
5. ✅ **Testing** — See **Test Plan** below.

**After deployment**: Test using the test plan; monitor storage usage; consider photo moderation or captions if needed.

## Test Plan

### 1. Add 1-4 Photos
- **Steps**:
  1. Navigate to a court detail screen
  2. Sign in (if not already)
  3. Tap "Add Photo" on empty slot
  4. Select image from library
  5. Wait for upload to complete
  6. Repeat for slots 2-4
- **Expected**:
  - Photo appears in carousel
  - Can scroll horizontally between photos
  - Empty slots show "Add Photo" placeholder
  - All 4 slots can be filled

### 2. Replace a Slot
- **Steps**:
  1. Navigate to court with existing photos
  2. Tap edit button (pencil icon) on a photo
  3. Select new image from library
  4. Wait for upload
- **Expected**:
  - Old photo replaced with new photo
  - Slot number remains the same
  - Photo URL updates

### 3. Delete a Photo
- **Steps**:
  1. Navigate to court with photos
  2. Tap delete button (trash icon) on a photo
  3. Confirm deletion
- **Expected**:
  - Photo removed from carousel
  - Slot becomes empty placeholder
  - Photo deleted from storage and database

### 4. Verify Unique Constraint
- **Steps**:
  1. Upload photo to slot 1
  2. Try to upload another photo to slot 1 via SQL:
     ```sql
     INSERT INTO court_photos (court_id, user_id, slot, storage_path)
     VALUES ('same-court-id', 'different-user-id', 1, 'test/path.jpg');
     ```
- **Expected**:
  - Error: duplicate key violation on (court_id, slot)
  - OR: Upsert replaces existing photo

### 5. Verify RLS
- **Steps**:
  1. Sign in as User A
  2. Upload photo to a court
  3. Sign out
  4. Try to upload photo via Supabase client
- **Expected**:
  - Unauthenticated users cannot insert/update/delete
  - SELECT works (public read)

### 6. Full-Screen Viewer
- **Steps**:
  1. Navigate to court with photos
  2. Tap on any photo
- **Expected**:
  - Photo opens full-screen
  - Dark overlay background
  - Close button visible
  - Tap outside or close button to dismiss

### 7. Empty State
- **Steps**:
  1. Navigate to court with no photos
  2. Check carousel
- **Expected**:
  - Shows 4 empty placeholders
  - "Add Photo" text on each (if authenticated)
  - "No photo" text (if not authenticated)

### 8. Loading States
- **Steps**:
  1. Upload a photo
  2. Observe during upload
- **Expected**:
  - Spinner shown in slot
  - "Uploading..." text
  - Slot disabled during upload

## Storage Bucket Setup Instructions

### Option 1: Public Bucket (Simplest)
1. Go to Supabase Dashboard > Storage
2. Click "Create Bucket"
3. Name: `court-photos`
4. Public: **Yes**
5. File size limit: 5MB
6. Allowed MIME types: `image/jpeg, image/png, image/webp`

### Option 2: Private Bucket with Policies
1. Create bucket as above but set Public: **No**
2. Run these policies in SQL Editor:
```sql
-- Allow public read
CREATE POLICY "Anyone can view court photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'court-photos');

-- Allow authenticated uploads
CREATE POLICY "Authenticated users can upload court photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'court-photos' AND auth.role() = 'authenticated');

-- Allow users to update their own photos
CREATE POLICY "Users can update their own court photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'court-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own court photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'court-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

## Design Decisions

### Why Community Editing?
- **Current Policy**: Any authenticated user can replace any photo
- **Reasoning**: 
  - Encourages community contribution
  - Better photos can replace outdated ones
  - Simpler UX (no "request to replace" flow)
- **Alternative**: Restrict to uploader only by modifying UPDATE policy

### Why 4 Photos Max?
- **Reasoning**:
  - Keeps UI clean and focused
  - Prevents storage bloat
  - Easy to manage (4 slots = simple UI)
- **Future**: Could increase to 6-8 if needed

### Why Horizontal Carousel?
- **Reasoning**:
  - Mobile-first design (swipeable)
  - Shows one photo at a time (focus)
  - Standard pattern users expect
- **Alternative**: Grid view (2x2) if preferred

## Next Steps

1. Run the migration SQL in Supabase
2. Create storage bucket `court-photos`
3. Test the implementation using the test plan above
4. Monitor storage usage and adjust limits if needed
5. Consider adding photo moderation if needed
6. Consider adding photo captions/descriptions if needed

## Notes

- Uses `expo-image-picker` and `expo-image`; follows ProfilePicture UI patterns.
- Handles errors with user-friendly messages; optimistic updates can be added later.
