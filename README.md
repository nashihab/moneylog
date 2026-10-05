# MONEYLOG — Installable Offline Money Journal

MONEYLOG is a privacy-first PWA built from scratch for everyday personal finance tracking. It keeps the core journal local and encrypts the application vault before it is stored in IndexedDB.

## What this build includes

- Password-protected local vault
- AES-GCM encrypted vault data with password-derived key
- Home dashboard with balance, monthly flow and budget
- Fast expense / income / transfer entry
- Multiple accounts with opening balances and archiving
- Custom expense and income categories
- History search and filters
- CSV export
- Monthly budget
- Spending insights and six-month flow
- Savings goals
- Recurring transactions generated safely when the app opens
- Encrypted `.moneylog` backup and restore
- Theme selection and amount masking
- Configurable auto-lock
- Daily journal reminder with notification permission
- App update prompt with **Update now** / **Remind me later**
- Offline service worker + installable PWA shell

The design intentionally avoids the previous dashboard/card-heavy feel and uses a responsive finance-first layout that works as a phone app and as a wider desktop PWA.

## Run locally

Service workers and Web Crypto require a secure context. `localhost` is treated as secure by browsers, so you can run:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

For phone installation and background capabilities, deploy the folder to **HTTPS** (GitHub Pages is suitable).

## Publishing updates from GitHub

The app reads `version.json` using a cache-busting request. To publish a new version:

1. Change `APP_VERSION` in `app.js`.
2. Change `CACHE_VERSION` in `sw.js`.
3. Update `version.json` with the same higher version and release notes.
4. Push the files to GitHub / GitHub Pages.

When a user opens MONEYLOG while online, the app compares the published version to its local version. If the published version is newer, it shows an update dialog with **Update now** and **Remind me later**. The financial vault never leaves the device.

`UPDATE_MANIFEST_URL` in `app.js` defaults to `./version.json`. When your GitHub Pages site serves the file from the same deployment, no further configuration is needed. A remote raw GitHub URL can also be used if the manifest is hosted elsewhere.

## Daily reminders

MONEYLOG asks for notification permission only after the user enables the daily reminder. It stores the reminder time locally. The app uses browser notification APIs and periodic background sync where available, and also checks for an overdue reminder whenever the app becomes active.

Background scheduling is a browser capability, not something a PWA can guarantee identically on every device. The UI therefore reports when notifications are blocked or unavailable rather than claiming native-alarm reliability.

## Security model and limitation

The vault payload is encrypted with AES-GCM using a key derived from the user's password with PBKDF2-HMAC-SHA-256. The raw password is never written to storage. The backup uses an independent password and encrypted payload.

This protects the stored app data against ordinary local storage inspection, but a web app is not equivalent to a hardware-backed Android Keystore application. A compromised device, malicious browser extensions, or a hostile page/runtime can still change the execution environment. Keep backups and protect the device itself.

## Privacy

- No account
- No analytics
- No advertising
- No financial-data upload
- No cloud database
- No payment processing
- All financial records stay local unless the user explicitly exports or shares a backup

## Important reminder limitation

A PWA can provide persistent service-worker notifications, but exact daily-at-a-specific-minute background behavior depends on the browser/OS. Periodic Background Sync is intentionally best-effort. For a hard real-time alarm guarantee on every Android device, a native Android implementation would be the correct platform choice.
