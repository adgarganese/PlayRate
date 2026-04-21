/**
 * Versioning (app.json `expo`):
 * - `version` — user-facing semver. Bare workflow: `runtimeVersion` must be a string (e.g. same as `version`);
 *   bump both when shipping a native build that must not accept old JS bundles. JS-only OTAs: keep both unchanged.
 * - `ios.buildNumber` (string) and `android.versionCode` (int) — increment both together for every binary
 *   submitted to App Store / Play Console (store-facing build id).
 *
 * EAS Update: `eas.json` maps `development` → channel `development`, `preview` → `preview`, `production` →
 * `production`. Publish OTAs with `eas update` using the matching channel (see EAS Update docs).
 *
 * Extends static app.json with:
 * - Android intent filters (custom scheme + optional App Links when EXPO_PUBLIC_UNIVERSAL_LINK_HOST is set)
 * - iOS associated domains (universal links) when the same env is set
 *
 * Universal links require a real host: serve AASA (and Android assetlinks) on that domain.
 * Set EXPO_PUBLIC_UNIVERSAL_LINK_HOST to the hostname only (e.g. app.playrate.com).
 * If you use universal links for auth: configure Supabase with https://<that-host>/auth/callback — the same
 * path your site serves for the handoff (AASA is typically under /.well-known/ on the same host).
 *
 * TODO: Until you have that host, leave EXPO_PUBLIC_UNIVERSAL_LINK_HOST unset; then set it, add the https
 * callback URL in Supabase, and rebuild native apps.
 *
 * Supported paths and share URL formats: see docs/deep-links.md.
 */
const base = require('./app.json').expo;

module.exports = () => {
  const rawHost = process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST;
  const universalHost =
    typeof rawHost === 'string' && rawHost.trim()
      ? rawHost.replace(/^https?:\/\//, '').split('/')[0].trim()
      : '';

  const schemeFilter = {
    action: 'VIEW',
    data: [{ scheme: base.scheme || 'playrate' }],
    category: ['BROWSABLE', 'DEFAULT'],
  };

  const httpsFilter = universalHost
    ? {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: universalHost, pathPrefix: '/' }],
        category: ['BROWSABLE', 'DEFAULT'],
      }
    : null;

  const intentFilters = [schemeFilter, ...(httpsFilter ? [httpsFilter] : [])];

  const ios = { ...base.ios };
  if (universalHost) {
    ios.associatedDomains = [`applinks:${universalHost}`];
  }

  return {
    expo: {
      ...base,
      ios,
      android: {
        ...base.android,
        intentFilters,
      },
    },
  };
};
