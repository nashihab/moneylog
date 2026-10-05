# MONEYLOG

MONEYLOG is a private, local-first money journal for recording income, expenses, transfers, budgets, recurring entries, savings goals and financial insights.

## Using MONEYLOG

Create a local username, password and recovery code when you first open the app. These credentials are for the local vault on this device; MONEYLOG does not create an online account.

The recommended setup is **Install Web App**. It gives MONEYLOG its own app-style window and makes the normal mobile workflow easier. The browser version is available too, but browser storage can be removed by site-data cleanup, storage management, browser reset, or uninstalling browser data.

For anything important, keep an encrypted `.moneylog` backup outside the browser. The backup is protected by a password chosen when the file is created.

## Main areas

**Home** shows total available money, the current month's income and expenses, a monthly budget, recent activity, and the accounts in use.

**History** is the searchable transaction record. Transactions can be filtered and edited without changing the meaning of transfers in reports.

**Insights** summarizes cash flow, category spending and account balances over useful time ranges.

**Settings** contains account management, categories, recurring entries, savings goals, reminders, appearance, backup and restore, password changes and update checks.

## Privacy

Financial records are stored locally in the MONEYLOG vault. There is no banking connection, payment processing, cloud database, advertising SDK, analytics service or financial-data upload.

MONEYLOG uses browser cryptography for the local vault and encrypted backup files. This protects the stored data from ordinary casual access, but it does not make a compromised device or a cleared browser profile recoverable.

## Password recovery

The recovery code is the local password-reset method. Keep it somewhere safe. There is no email-based or server-side account recovery because MONEYLOG is intentionally local-only.

## Daily reminders

Daily reminders can be enabled in Settings and assigned a time. Notification delivery depends on the browser and operating system. When background scheduling is unavailable, MONEYLOG also checks when the app is opened or brought back to the foreground.

## Updates

When a newer MONEYLOG release is published, the app checks the public version file while online. A release prompt offers **Update now** or **Remind me later**. Installed users are not shown the first-use install prompt again.

## Backup and restore

Export creates a password-protected `.moneylog` file. Restore verifies the file and password before replacing the current local vault. Keep at least one backup outside the browser profile.

## About

MONEYLOG - Personal Money Journal

Made with ♥ by nashihab

Developer: https://nashihab.github.io

## Refresh and locking
Refreshing the app does not intentionally lock the current session. MONEYLOG restores the active encrypted session after a refresh while the selected auto-lock period has not expired. Use the Lock control when you want to end the session immediately.

## 2.1.4 UI refresh

The current interface uses a tighter type scale, a centered five-item mobile navigation, a dedicated Add action, and a standard lock icon. The layout is designed to feel compact and app-like rather than oversized or template-like.


## 2.2.0 quality and data protection update

MONEYLOG 2.2.0 adds a cleaner interface, a clearer circular Lock control, smarter daily-entry defaults, and a smoother staged update flow.

### Data Shield
MONEYLOG now requests persistent browser storage where supported. It also supports a protected `.moneylog` recovery file that can live outside browser site storage. After setup, changes can update that protected file automatically while the app is open.

This is the important limitation to understand: a full browser cleanup of Cookies and other site data can remove IndexedDB, local storage, caches, and related origin data. Installing a PWA does not turn browser storage into an independent cloud vault. Data Shield gives the app a durable recovery path outside that origin storage.

On a browser that supports the File System Access API, use **Settings → Data Shield → Protect my data**. Keep the protected file somewhere safe. After a site-data reset, open MONEYLOG and choose **Restore protected MONEYLOG**.

### Update flow
Updates are checked quietly online. When a new version is found, MONEYLOG shows the release notes first, installs the new service-worker cache, hands control to it, and then reloads the app once the new shell is active. Your encrypted vault is separate from the app shell.


## 2.3.0 safety and organization

- Added a previous encrypted vault snapshot for recovery from damaged local writes.
- Added clearer backup health status and stronger Data Shield messaging.
- Added Install Web App and Use Web Version controls directly to the setup and login screens.
- Protected-file creation now chooses the file first and verifies the written file after saving.
- Runtime assets are organized under `assets/` and supporting documentation under `docs/`.

A deliberate browser/site-data wipe can still remove browser-managed storage. The protected `.moneylog` file is the recovery layer designed to survive that cleanup.
