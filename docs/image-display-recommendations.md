# Image display — recommendations (Issue #17)

## Upload pipeline

- Avatars, court photos, and highlight **images** are resized/compressed with `expo-image-manipulator` in `lib/image-upload-prepare.ts` before upload. **Videos** are unchanged.

## expo-image vs React Native `Image`

- **Current state:** User-facing media (avatars, highlights, court carousel, explore, chat avatars, etc.) already use **`expo-image`** for decoding, disk/memory cache, and transitions.
- **Recommendation:** Prefer **`expo-image`** for any new screens that load remote bitmaps. Avoid introducing `Image` from `react-native` for network URIs unless you have a specific constraint (e.g. a third-party API that requires it).
- **Why:** Better caching, `contentFit`, `placeholder`, `transition`, `recyclingKey` for lists, and optional blurhash placeholders later.

## Loading and error UX (incremental improvements)

- **Loading:** Use `expo-image` `placeholder` (blurhash or low-res) and/or a local skeleton where images are above-the-fold in feeds.
- **Errors:** Use `onError` to swap to a neutral placeholder (icon or tinted box) so broken Storage URLs do not show an empty gap. `ProfilePicture` and `HighlightPoster` include basic `onError` fallbacks; extend the same pattern to court carousel thumbs and list rows when touching those files.

## Security / performance note

- Uploads are normalized to **JPEG** after manipulation to keep buckets consistent and payloads smaller. HEIC/PNG from the picker are converted at prepare time.
