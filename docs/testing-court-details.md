# Testing Court Details After Migration

## ✅ Migration Complete!

The database now has all the new columns. Here's how to test everything:

---

## 🧪 Step-by-Step Testing

### 1. **Verify Migration Worked**

The app should now automatically fetch all new columns. To verify:
- Open any existing court details screen
- It should load without errors
- New fields will be null for existing courts (that's expected)

### 2. **Create a New Court with Detailed Fields**

1. Navigate to **"Add Court"** screen
2. Fill in **required fields**:
   - Court Name (e.g., "Riverside Basketball Court")
   - Address (e.g., "123 Main St, City, State")
   - Select at least one Sport (e.g., Basketball)

3. Fill in **optional detailed fields** (try filling them all):
   - **Type**: Select Indoor or Outdoor
   - **Hoop Count**: Enter a number (e.g., "4")
   - **Court Type**: Select Full, Half, or Both
   - **Surface Type**: Enter type (e.g., "Hardwood", "Asphalt", "Sport court")
   - **Has Lights**: Toggle ON if the court has lighting
   - **Cost**: Enter cost (e.g., "Free", "Paid", "$5/hour")
   - **Hours**: Enter hours (e.g., "6am - 10pm", "24/7")
   - **Parking**: Select Street, Lot, or None
   - **Amenities**: Select multiple (e.g., Water fountain, Restrooms, Benches, Wi-Fi)
   - **Notes/Rules**: Add some text (e.g., "First come, first serve. No reservations.")

4. **Optional**: Add an initial comment
5. Click **"Save Court"**

### 3. **View the Enhanced Court Details**

Navigate to the court you just created (or any court with detailed fields):

#### **Check Header Section:**
- ✅ Court name displays correctly
- ✅ Address is tappable (tap to see copy option, long press to open maps)
- ✅ Tags appear if applicable (Indoor/Outdoor, Free/Paid, Lights)
- ✅ Action buttons work:
  - **Directions**: Opens navigation (works if lat/lng exists)
  - **Favorite**: Toggles follow status
  - **Share**: Shows alert (placeholder for now)

#### **Check Quick Facts Grid:**
- ✅ 2-column grid layout
- ✅ Shows all filled fields with icons:
  - Hoop count (basketball icon)
  - Court type (grid icon)
  - Surface (square icon)
  - Lighting (lightbulb icon) - shows "Yes" or "No"
  - Hours (clock icon)
  - Parking (car icon)
- ✅ Fields that are null/empty should be hidden (not show "—")
- ✅ Cards are styled consistently

#### **Check Amenities Section:**
- ✅ Only appears if amenities are selected
- ✅ Shows as chips with checkmarks
- ✅ Each amenity has an icon
- ✅ Styled consistently with app theme

#### **Check Notes/Rules Section:**
- ✅ Only appears if notes exist
- ✅ Displays full text with proper formatting
- ✅ In a card with proper spacing

#### **Check Other Sections:**
- ✅ Chat section still works
- ✅ Comment input still works
- ✅ Comments list still displays

### 4. **Test Light & Dark Mode**

Switch between light and dark mode and verify:
- ✅ All text is readable (white text in dark mode, dark text in light mode)
- ✅ Cards have proper background colors
- ✅ Buttons have proper contrast
- ✅ Icons are visible
- ✅ Tags/chips are visible
- ✅ No hardcoded colors are breaking the theme

### 5. **Test Edge Cases**

#### **Court with Minimal Info:**
- Create a court with only name, address, and sports
- Verify it still displays correctly
- Verify sections are hidden when data is null

#### **Court with All Fields:**
- Create a court filling in everything
- Verify all sections display correctly
- Verify nothing is cut off or overlapping

#### **Existing Courts (from before migration):**
- Open an old court
- Verify it loads without errors
- Verify it shows basic info only (no detailed fields)

### 6. **Test Interactions**

- ✅ Tap address → should show copy option (web) or alert (mobile)
- ✅ Long press address → should open maps
- ✅ Directions button → should open navigation app
- ✅ Favorite button → should toggle follow status
- ✅ Share button → should show alert (placeholder)
- ✅ All form inputs in "Add Court" work correctly
- ✅ Form validation works (name, address, sports required)

---

## 🐛 Troubleshooting

### **If court details don't load:**
1. Check browser/device console for errors
2. Verify migration ran successfully in Supabase
3. Try refreshing the app

### **If fields aren't showing:**
1. Verify you filled them in when creating the court
2. Check that the fields are not null in the database
3. Ensure the app is fetching all columns (check network tab)

### **If styling looks off:**
1. Switch between light/dark mode
2. Verify no hardcoded colors are being used
3. Check that theme tokens are being used correctly

---

## ✅ Success Criteria

Everything is working if:
- ✅ You can create a court with detailed fields
- ✅ All sections display correctly on the details screen
- ✅ All fields are theme-aware (light/dark mode work)
- ✅ Interactions work (directions, favorite, share)
- ✅ Existing courts still work
- ✅ No console errors

---

## 🎉 Next Steps

Once everything is tested and working:
1. **Edit Flow**: If you want to allow editing existing courts, create an edit screen similar to the "Add Court" screen
2. **Share Functionality**: Implement native share using `expo-sharing` or React Native Share API
3. **Clipboard**: Add `expo-clipboard` package for better clipboard support on mobile

Enjoy your enhanced court details! 🏀
