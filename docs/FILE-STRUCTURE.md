# MONEYLOG File Structure

The repository is a static Progressive Web App. Its files are served directly and do not require a compilation or bundling process.

| Path | Responsibility |
|---|---|
| `index.html` | Root entry point, security metadata, manifest/style links, application mount point |
| `demo.html` | Lightweight read-only demo entry point |
| `manifest.json` | Install name, start URL, display mode, theme colors, and app icons |
| `sw.js` | Service Worker install/activation, app-shell cache, offline fallback, notifications, periodic reminders |
| `version.json` | Current published version and release notes checked by the update flow |
| `assets/app.js` | Local vault, login/setup, validation, state, financial calculations, history, insights, backup, restore, update flow |
| `assets/styles.css` | Layout, responsive rules, neumorphic surfaces, color tokens, light/dark theme, focus, motion preferences |
| `assets/icon.svg` | Scalable MONEYLOG icon |
| `assets/icon-192.png` | 192-pixel PWA icon |
| `assets/icon-512.png` | 512-pixel PWA icon |
| `docs/DATA-PROTECTION.md` | Storage model, encrypted backups, recovery, and limitations |
| `docs/FILE-STRUCTURE.md` | Repository file inventory and responsibility map |
| `tests/finance.test.cjs` | Node-based tests for financial calculations and data normalization |
| `README.md` | Product overview, features, financial model, architecture, operation, security, deployment, and tests |
| `LICENSE` | Source-available usage restrictions and permissions |

## Key dependencies

The application relies on built-in browser APIs: IndexedDB, Web Crypto, Service Workers, the web app manifest, and standard DOM/CSS functionality. Notification, periodic background sync, persistent storage, and File System Access capabilities depend on browser support and user permission.

## Release consistency

A published release aligns `APP_VERSION` in `assets/app.js`, the cache identifier in `sw.js`, and the `version` field in `version.json`. The entry point and all app-shell resources remain at the paths listed in the Service Worker's core asset list. The encrypted user vault is stored separately from the Service Worker cache.
