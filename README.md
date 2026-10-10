# MONEYLOG

**Personal Money Journal**  
**Your money. Your record. Your control.**

MONEYLOG is a local-first Progressive Web App (PWA) for recording everyday finances and understanding personal cash flow. It brings account balances, income, expenses, transfers, budgets, savings goals, history, insights, and encrypted recovery into a single, lightweight interface.

The product is designed around three principles: **clear financial records, private-by-default storage, and low-friction everyday use**. MONEYLOG is a record-keeping tool. It is not a bank, wallet, payment processor, investment product, or source of financial advice.

- **Current version:** 2.6.1
- **Application type:** Installable Progressive Web App
- **Default currency:** Bangladeshi Taka (BDT / ৳)
- **Storage:** Browser IndexedDB and local browser preferences
- **Backend:** None required
- **Data synchronization:** None
- **License:** MONEYLOG Source-Available License 1.0

## Contents

- [Product overview](#product-overview)
- [Features](#features)
- [Visual design](#visual-design)
- [Financial model](#financial-model)
- [Architecture](#architecture)
- [Privacy and security](#privacy-and-security)
- [Data protection and recovery](#data-protection-and-recovery)
- [Installation](#installation)
- [Browser preview](#browser-preview)
- [Updates](#updates)
- [Deployment](#deployment)
- [Development and testing](#development-and-testing)
- [Repository structure](#repository-structure)
- [Compatibility and limitations](#compatibility-and-limitations)
- [Copyright and usage](#copyright-and-usage)
- [Project information](#project-information)

## Product overview

MONEYLOG focuses on common personal-finance tasks without introducing accounting terminology or requiring an online profile. Its main navigation provides access to Home, History, Add, Insights, and Settings.

The Home dashboard surfaces total available money, monthly income and expenses, recent transactions, budget context, and account balances. History provides a searchable record of activity. Insights summarizes cash flow and category spending across date ranges. Settings contains preferences, security and recovery tools, reminders, and application updates.

The installed PWA and browser version use the same application logic. The difference is the browser or operating system's installation and storage environment, not a separate financial data model.

## Features

### Home dashboard

- Total balance across active and archived personal accounts.
- Monthly income, expenses, and net flow.
- Recent transactions and account balances.
- Optional hide/show control for monetary amounts.
- Current date and budget context where available.
- Quick access to income, expense, transfer, and account workflows.
- A read-only demo preview for first-time visitors who have not created a local vault.

### Transactions

MONEYLOG records three transaction types:

- **Income** increases the selected account balance.
- **Expense** decreases the selected account balance.
- **Transfer** moves money between two personal accounts without changing total money or income/expense reports.

Transactions include an amount, date, account, category where applicable, and optional note. Existing entries can be reviewed, edited, or deleted. The application validates monetary input and normalizes stored amounts before calculations.

### Accounts

Separate accounts support cash, bank accounts, mobile financial accounts, savings, and custom uses. Each account has an opening balance and a computed balance. Creating an account does not combine it with another account merely because the names match. Archived accounts retain historical records and remain represented in total-money calculations.

### Categories and budgets

Default income and expense categories provide a compact starting point. A monthly spending budget can be set to compare expenses with a target. Transfers are excluded from spending totals. Budget tracking is optional and does not alter account balances.

### History and insights

History supports transaction review, search, filters, editing, and CSV export. Insights includes date-based income/expense totals, category spending, recent monthly trends, and an account balance overview. The same transaction signs and balance rules are used across the dashboard and reports.

### Savings goals and recurring entries

Savings goals track a target independently of ordinary account transactions. Recurring entries represent scheduled income or expense templates. Due entries are handled locally when the app opens, with duplicate prevention; recurring templates are not a cloud-scheduled service.

### Appearance and reminders

The interface includes light, dark, and system appearance options. The default appearance is light. Daily reminders can be enabled and configured from Settings. Reminder delivery depends on browser permission, platform support, and whether the application is allowed to run the relevant background capability.

## Visual design

MONEYLOG uses a restrained **neumorphic design system**. Raised surfaces identify interactive panels and controls, while inset surfaces distinguish inputs and selected states. The visual language uses a muted sage background, forest-green accents, rounded geometry, deliberate spacing, and tabular-number treatment for financial values.

The light and dark palettes share the same information hierarchy. Income, expenses, warnings, and neutral information use consistent colors with text labels so meaning does not rely on color alone. Focus indicators, responsive layouts, mobile safe-area spacing, and reduced-motion preferences are part of the design system.

Visual effects are intentionally restrained. Large blur filters are avoided across the main interface to reduce rendering cost on mobile devices. Motion is limited to short state transitions and small interaction feedback rather than continuous decorative animation.

## Financial model

### Monetary representation

Amounts are stored as integer minor units, with 100 minor units representing one displayed major currency unit. For BDT, a stored value of `125050` represents ৳1,250.50. Monetary input is validated before converting to minor units. Display formatting is separate from the underlying integer representation.

### Account balance

For each account:

```text
Current balance
  = Opening balance
  + Income
  - Expenses
  - Transfers out
  + Transfers in
```

Total available money is the sum of the computed balances for all accounts. A transfer between accounts changes the balances of its source and destination by equal and opposite amounts, leaving the total unchanged.

### Reporting rules

- Income and expenses are included in their corresponding report totals.
- Transfers are excluded from income, expenses, and spending budgets.
- Reports use local calendar date keys for period boundaries.
- Current-month totals use the local calendar month rather than converting local midnight to UTC.
- Zero and invalid monetary values do not produce a phantom balance.
- Account balances are derived from opening balances and transactions instead of relying on a second manually maintained balance total.

These rules are covered by the finance regression tests in `tests/finance.test.cjs`.

## Architecture

MONEYLOG is a static client-side application. It does not require an application server or a remote database.

```text
Browser or installed PWA
        │
        ├── HTML application shell
        ├── CSS design system
        └── JavaScript application logic
                  │
          ┌───────┴────────┐
          │                │
       IndexedDB       Web Crypto API
   encrypted vault     PBKDF2 / AES-GCM
          │                │
          └───────┬────────┘
                  │
             Data Shield
      safe snapshot / encrypted file

Service Worker
  app-shell cache, offline loading, release checks
```

### Application shell

`index.html` loads the stylesheet and application logic, declares the web app manifest, and defines the root containers for the interface, notifications, and dialogs.

### Application logic

`assets/app.js` manages vault setup and unlock, validation, the application state, transaction workflows, calculations, reports, backups, reminders, and update behavior. Financial balances are derived from a centralized snapshot of account openings and transaction records. IndexedDB writes are coordinated to reduce the risk of overlapping vault saves.

### Local persistence

IndexedDB stores the encrypted vault and supporting metadata. Public preferences are kept separate from encrypted financial records where required for app behavior. The Service Worker caches the application shell so the interface can reopen offline after its resources have been cached.

### Service Worker and release manifest

`sw.js` handles app-shell caching, cache lifecycle, update activation, notification clicks, and supported periodic reminders. Cache cleanup is restricted to the `moneylog-cache-` namespace so unrelated applications hosted on the same origin are not removed. `version.json` describes the published application version and its update notes. The app checks the manifest while online and offers an update when a newer version is detected.

## Privacy and security

MONEYLOG is designed to keep financial records local. It does not require an online account and does not intentionally send transaction data to a remote service.

### Vault protection

- Password-based keys are derived using PBKDF2 with SHA-256 and a per-vault salt.
- Vault content is encrypted with AES-GCM through the Web Crypto API.
- AES-GCM uses authenticated encryption to detect modified ciphertext.
- A recovery code provides a local password-recovery path.
- Session access is cleared when the application is explicitly locked or the session expires according to its configured lock behavior.
- The application entry point declares a Content Security Policy, limits unnecessary browser capabilities, and avoids inline JavaScript.

These controls improve confidentiality and data integrity but do not make the application immune to compromised devices, malicious browser extensions, unsafe hosting, weak passwords, or other attacks against the local environment. A local user who can access an unlocked browser session may be able to view its data.

### Recovery code

The username and recovery code are stored for local verification and key recovery. They are not an online identity and cannot be sent by MONEYLOG to an email address. A forgotten password and lost recovery code may make an encrypted vault unrecoverable without an independent protected backup.

## Data protection and recovery

Browser storage is managed by the browser and operating system. An installed PWA does not make its IndexedDB data immune to deliberate site-data deletion, profile removal, browser reset, or device failure.

Data Shield uses several complementary mechanisms:

1. **Encrypted primary vault:** financial state is encrypted before being written to IndexedDB.
2. **Previous safe copy:** a previous encrypted vault record can provide a recovery point if the latest write is missing or unreadable.
3. **Persistent storage request:** where supported, MONEYLOG requests persistent browser storage to reduce automatic eviction. This does not prevent explicit deletion.
4. **External protected file:** a password-protected `.moneylog` file provides recovery outside the browser's site storage.
5. **Encrypted export and restore:** a versioned file format enables an encrypted backup to be exported and restored with a password.

A protected external file should be kept separately from the browser profile. On browsers that support the File System Access API, a selected protected file can be updated while MONEYLOG is running. Other browsers can use downloaded encrypted backup files.

Restore validates the backup and its password before asking for confirmation to replace the local vault. A backup password is not stored in plaintext in the export file. Losing both the local vault and the necessary recovery material can result in permanent data loss; regular independent backups remain important.

More detail is available in [`docs/DATA-PROTECTION.md`](docs/DATA-PROTECTION.md).

## Installation

### Installable Web App

On a supported browser, the installation option adds MONEYLOG to the device's app launcher or home screen. The installed app opens in a standalone window and uses the same local-first application.

- **Android:** a supported browser such as Chrome may offer Install app or Add to Home screen.
- **iOS and iPadOS:** Safari offers Add to Home Screen through the Share menu.
- **Desktop:** compatible browsers may expose an install icon or install command in the browser menu.

Exact menu labels and installation support vary by browser and operating-system version. No APK is required.

### Browser version

The browser version is available for a quick visit or demo. It shares the PWA's browser storage boundaries. The read-only preview is not the same as a registered vault and does not seed demo transactions into a user's real financial data.

### First-time setup

A new local vault is created with a username, password, and recovery code. Those values belong to the device's local MONEYLOG profile; they do not create a cloud account. An existing vault is opened with its username and password. The recovery code is used for local password recovery.

## Browser preview

A fresh browser visit without an existing vault can open a read-only Home preview populated with clearly illustrative sample records. It provides a view of the dashboard without creating or saving fake financial data. Starting a real data action transfers the session into the setup flow before any user-entered records are saved.

The preview is also available through `demo.html` or the `?demo=1` query parameter. Demo totals are illustrative and should not be interpreted as real financial records.

## Repository structure

```text
MONEYLOG/
├── index.html                 # Application entry point and security metadata
├── demo.html                  # Read-only demo entry point
├── manifest.json              # Installable PWA metadata and icons
├── sw.js                      # Offline cache, lifecycle and notification handlers
├── version.json               # Published version and update notes
├── README.md                  # Product, architecture and operating reference
├── LICENSE                    # Source-available usage terms
├── assets/
│   ├── app.js                 # UI, vault, calculations and app workflows
│   ├── styles.css             # Responsive design system and themes
│   ├── icon.svg               # Scalable application icon
│   ├── icon-192.png           # PWA icon
│   └── icon-512.png           # High-resolution PWA icon
├── docs/
│   ├── DATA-PROTECTION.md     # Vault, recovery and storage limitations
│   └── FILE-STRUCTURE.md      # Directory and file responsibilities
└── tests/
    └── finance.test.cjs       # Finance invariants and normalization checks
```

## Compatibility and limitations

- MONEYLOG requires a modern browser with IndexedDB, Web Crypto, and JavaScript support.
- Service Workers and Web Crypto require a secure context, typically HTTPS or localhost.
- Browser storage can be removed by explicit site-data cleanup or profile deletion.
- Install prompts, background notifications, periodic sync, and filesystem handles depend on browser and operating-system support.
- There is no bank integration, payment processing, cloud synchronization, multi-user sharing, or remote recovery service.
- The application is not a native Android application and does not use Android Keystore, Room, or BiometricPrompt.
- Local encryption protects stored vault content, but it does not secure a device that is already compromised or an unlocked session accessible to another person.

## Copyright and usage

Copyright © 2026 nashihab. All rights reserved.

MONEYLOG is distributed under **MONEYLOG Source-Available License 1.0**. The source may be viewed, studied, and run locally for personal, educational, and non-commercial purposes, subject to the license. Public redistribution, republishing, commercial distribution, white-labeling, and presenting a copy or derivative as the original project require prior written permission.

The license is source-available and is **not an OSI-approved open-source license**. The complete terms are in [`LICENSE`](LICENSE).

## Project information

**MONEYLOG - Personal Money Journal**  
Made with ♥ by nashihab  
Developer: <https://nashihab.github.io>  
Project: <https://github.com/nashihab/moneylog>

MONEYLOG is a private financial record-keeping tool. It does not provide financial, investment, banking, tax, or legal advice. Financial records should be verified independently when used for consequential decisions.
