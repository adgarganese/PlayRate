/**
 * Side-effect import: initialize Sentry as early as possible in the root module graph.
 * Imported first from `app/_layout.tsx` so SDK init runs before most other app modules.
 */
import { initSentry } from './sentry';

initSentry();
