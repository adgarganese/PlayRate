/**
 * Safe strings for Alert() and inline error UI.
 * Never surface raw PostgREST / Supabase / JWT / SQL messages to users.
 */
export const UI_GENERIC = 'Something went wrong. Please try again.';
export const UI_LOAD_FAILED = "We couldn't load this right now. Please try again.";
export const UI_SAVE_FAILED = "We couldn't save your changes. Please try again.";
export const UI_UPLOAD_FAILED = "Upload didn't finish. Check your connection and try again.";
export const UI_FOLLOW_FAILED = "We couldn't update follow. Please try again.";
export const UI_RATING_SAVE_FAILED = "We couldn't save your rating. Please try again.";
export const UI_CHECK_IN_FAILED = "Check-in didn't complete. Please try again.";
export const UI_SUGGESTION_FAILED = "We couldn't send your suggestion. Please try again.";
export const UI_PROFILE_LOAD_FAILED = "We couldn't load your profile. Please try again.";
export const UI_HIGHLIGHTS_LOAD_FAILED = "We couldn't load highlights. Pull down to refresh.";
export const UI_COURT_LOAD_FAILED = "We couldn't load this court. Please go back and try again.";
export const UI_DELETE_PHOTO_FAILED = "We couldn't delete that photo. Please try again.";
export const UI_REMOVE_AVATAR_FAILED = "We couldn't remove your profile photo. Please try again.";
