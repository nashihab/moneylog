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

## Copyright & Usage

Copyright © 2026 nashihab. All rights reserved.

MONEYLOG and its source code, design, interface, assets, documentation, and related materials are the original work of **nashihab**.

You may view the repository for personal, educational, and reference purposes. You may also fork the repository for development or experimentation, provided that the original copyright notice and attribution remain intact.

**You may not:**

* Re-upload or republish this project or substantial portions of it as your own work.
* Remove, replace, or obscure the original copyright and attribution.
* Publish a modified or unmodified copy under your own name or organization as an original project.
* Sell, redistribute, or commercially package this project without written permission from the copyright holder.
* Use the project branding, name, or identity in a way that implies ownership or official endorsement.

Modifications and derivative versions must clearly state that they are based on the original MONEYLOG project by **nashihab** and must retain the original copyright notice.

This repository does **not** grant permission to claim authorship or ownership of the original work.

For permissions beyond those stated above, contact the copyright holder.


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


### 2.3.1 release-candidate hardening

This release hardens responsive layout behavior across narrow phones, tablet widths, setup/login, update banners, modal sheets, and the mobile navigation area. It also fixes the update handler so the staged update flow is not shadowed by duplicate code, keeps the Insights page shell intact during range changes, and strengthens protected-file reconnect behavior.

For PWA deployment, the manifest now has a stable application ID and dedicated 192px and 512px PNG icons.
