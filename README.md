# MONEYLOG

**Personal Money Journal**

Your money. Your record. Your control.

MONEYLOG is a local-first personal finance PWA for recording income, expenses, transfers,
budgets, recurring entries, savings goals, and financial insights without requiring an
online account or a cloud database.

> Copyright © 2026 nashihab. All rights reserved.

## Why MONEYLOG

MONEYLOG is designed for everyday use, not complicated accounting workflows.

- Private by default. Financial records stay in the local vault.
- Encrypted vault. The active vault is protected with browser cryptography.
- Installable. Use MONEYLOG as a standalone Web App or in the browser.
- Offline-friendly. Core app files are cached for normal offline use.
- Recovery-focused. Data Shield adds persistent-storage protection, a previous safe
  vault copy, and an encrypted external recovery file.
- No ads, analytics, banking connection, or payment processing.

## Main features

### Home

See total available money, monthly income and expenses, net flow, budget status,
recent activity, and account balances.

### History

Search and filter transactions, review transfers, edit records, and export transaction
history as CSV.

### Insights

Review cash flow, category spending, and account balances across useful time ranges.

### Accounts

Manage cash, bank, savings, mobile money, and other accounts. Transfers keep account
balances consistent without being counted as income or expense.

### Budgets and goals

Set an overall monthly spending limit and track personal savings goals without mixing
planning figures into account balances.

### Recurring entries

Create recurring income or expense entries. MONEYLOG generates due entries when the
app opens and prevents duplicate generation.

### Reminders

Optional daily reminders can be enabled from Settings. Delivery depends on browser
and operating-system support.

## Security model

MONEYLOG is intentionally local-first. There is no server-side account system for your
financial records.

The vault uses authenticated encryption through the Web Crypto API. Password-based
keys are derived with PBKDF2 and a per-vault salt.

The local recovery code is the supported password-reset method. Keep it somewhere safe.
There is no email-based or cloud recovery system.

## Data Shield

Browser storage is not a permanent external backup. Clearing browser site data can
remove IndexedDB, local storage, caches, and other origin data even when the app is
installed as a PWA.

Data Shield is designed around that limitation.

1. **Encrypted vault**
   Your active MONEYLOG records are encrypted in the local vault.

2. **Previous safe copy**
   MONEYLOG keeps the previous encrypted vault record before replacing the current one,
   providing a local recovery point for a bad write or corrupted latest record.

3. **Persistent storage**
   MONEYLOG requests persistent browser storage where the browser supports it. This can
   reduce automatic eviction, but it cannot override an explicit site-data cleanup.

4. **External recovery file**
   A password-protected `.moneylog` file can live outside browser storage. On browsers
   with the File System Access API, MONEYLOG can keep the selected file updated while the
   app is open.

For important records, keep the protected `.moneylog` file somewhere outside the browser
profile as well.

## Installation

### Recommended: Install Web App

Open MONEYLOG in a supported browser and choose **Install Web App**. The app then opens
in its own app-style window.

### Browser version

Choose **Use Web Version** when you prefer to stay in a normal browser tab. The same
features are available, but the browser still controls the storage lifecycle.

### First setup

Create a local username, password, and recovery code. The setup screen also provides
Install Web App and Use Web Version controls, so the access mode can be chosen before
creating the vault.

## Backup and restore

### Encrypted backup

Use Settings to download a password-protected `.moneylog` backup. Keep the file in a
separate location from the browser profile.

### Protected recovery file

Data Shield can create a protected `.moneylog` file and remember the file handle on
supported browsers. Future saves can update that file automatically while MONEYLOG is
running.

### Restore

Restore verifies the protected file and its password before replacing the current local
vault. Existing local data is not replaced without confirmation.

## Updates

MONEYLOG checks `version.json` when online.

When a newer release is available, the interface shows **Update now**. The update flow:

1. refreshes the service-worker registration with HTTP cache bypass;
2. installs the new app-shell cache with reload semantics;
3. promotes the waiting service worker with `skipWaiting`;
4. waits for the new worker to control the page;
5. reloads MONEYLOG once the new app shell is active.

The financial vault is stored separately from the PWA cache, so app updates do not
replace transaction data.

## Deployment

MONEYLOG is designed for static hosting such as GitHub Pages.

Upload the contents of this repository as-is. `index.html` remains at the repository
root because it is the application entry point.

A production deployment should serve the site over HTTPS. Service workers and Web Crypto
require a secure context in normal production use.

## Repository structure

```text
MONEYLOG/
├── index.html
├── manifest.json
├── sw.js
├── version.json
├── README.md
├── LICENSE
├── assets/
│   ├── app.js
│   ├── styles.css
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
└── docs/
    ├── DATA-PROTECTION.md
    └── FILE-STRUCTURE.md
```

## Development notes

MONEYLOG does not require a backend for its core functionality. A simple static server
is enough for local development.

For example:

```text
python -m http.server 8080
```

Then open the local HTTPS/secure-context equivalent supported by your development setup.
For service-worker and Web Crypto behavior, production HTTPS is the authoritative
environment.

## Privacy

MONEYLOG does not intentionally upload your financial records to a remote service.
There is no analytics SDK, advertising network, banking connector, or payment service.

Your browser, operating system, backup destination, and device security still matter.
No local web application can guarantee recovery after deliberate deletion of browser
site data unless an external backup exists.

## Copyright and usage

Copyright © 2026 nashihab. All rights reserved.

The source is **source-available, not open source** under an OSI-approved license.
Viewing, studying, and private non-commercial use are permitted under the accompanying
`LICENSE` file.

Public re-uploading, redistribution, white-labeling, commercial packaging, and claiming
a copy or derivative as your own are not permitted without written permission.

Do not remove the original copyright or attribution.

## About

**MONEYLOG - Personal Money Journal**

Made with ♥ by nashihab

Developer: https://nashihab.github.io

Original project: https://github.com/nashihab/moneylog
