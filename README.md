# MONEYLOG

### Personal Money Journal

> **Your money. Your record. Your control.**

MONEYLOG is an **open-source, private, offline-first personal finance Progressive Web App (PWA)** for recording and understanding everyday finances without requiring a financial account, cloud database, or payment service.

It is a **money journal**, not a digital wallet, banking app, payment gateway, or financial service. It records transactions entered by the user and does not process real payments.

---

## Why MONEYLOG?

Managing personal money should not require handing your financial history to a third-party service.

MONEYLOG is built around a simple idea:

> **Make recording money effortless, understanding money clear, and keeping financial data private the default.**

The project focuses on four principles:

* **Simple** - record an expense, income, or transfer in seconds.
* **Private** - financial records stay in local browser storage by default.
* **Offline-first** - the application shell can continue working without an internet connection after installation/loading.
* **Open source** - the code is available to inspect, modify, self-host, and contribute to.

---

## Features

### Dashboard

* Total balance across accounts
* Current-month income
* Current-month expenses
* Optional monthly spending budget
* Recent transactions
* Hide/show monetary amounts
* Quick-add transaction button

### Transactions

MONEYLOG supports:

* **Expenses**
* **Income**
* **Transfers between your own accounts**

Transactions can be created, edited, deleted, categorized, assigned to an account, dated, and given an optional note.

### Accounts

Create multiple personal accounts such as:

* Cash
* Bank account
* Savings
* Mobile financial account
* Other custom accounts

Transfers between accounts are kept separate from income and expense calculations.

### History

Review transactions chronologically and search through recorded entries.

### Insights

See basic financial summaries including:

* Income for the current month
* Expenses for the current month
* Spending by category
* Account balances

### Budgets

Set an overall monthly spending limit and see how much has been used.

### Encrypted Backup & Restore

Export your local MONEYLOG data into an encrypted `.moneylog` file and restore it later using the password you choose.

---

## Privacy

MONEYLOG is designed to work without a backend.

The current application does **not** require:

* An account or registration
* Login
* A MONEYLOG cloud account
* A remote database
* Cloud synchronization
* Advertising SDKs
* Analytics or telemetry
* Automatic uploading of financial records
* Banking or financial APIs

Your financial records remain in the browser storage of the device where MONEYLOG is being used unless you explicitly export them.

### Important storage limitation

Browser storage is not the same as a native database protected by a mobile operating system's hardware security layer. Site data can be cleared by the user or, depending on the platform, by the browser/operating system.

**Back up important data regularly.**

MONEYLOG does not claim that any device or browser environment is impossible to compromise.

---

## Backup Security

Encrypted backups use the browser's **Web Crypto API**.

The current backup implementation uses:

* PBKDF2 with SHA-256 for password-based key derivation
* AES-GCM with a 256-bit key for authenticated encryption
* A random salt for each backup
* A random initialization vector (IV) for each backup
* A versioned backup format

The backup password is not stored in the exported file.

### Export

```text
Settings
   ↓
Export encrypted backup
   ↓
Choose a password
   ↓
Create moneylog-backup.moneylog
```

### Restore

```text
Select .moneylog file
   ↓
Enter password
   ↓
Verify + decrypt
   ↓
Confirm replacement
   ↓
Restore local data
```

Keep your backup password safe. An encrypted backup cannot be recovered by MONEYLOG if the password is forgotten.

---

## Install on a Phone

MONEYLOG is a **Progressive Web App**, so you do **not** need an APK.

### Android

1. Open the deployed MONEYLOG site in Chrome.
2. Choose **Install app** or **Add to Home screen**.
3. Open MONEYLOG from the new home-screen icon.

### iPhone / iPad

1. Open the deployed site in Safari.
2. Open the Share menu.
3. Choose **Add to Home Screen**.
4. Launch MONEYLOG from the home screen.

Browser behavior may vary slightly by operating-system and browser version.

---

## How It Works

MONEYLOG uses a local-first architecture:

```text
┌───────────────────────────────┐
│           MONEYLOG UI         │
│ Home · History · Insights     │
│ Settings · Transaction Entry  │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│        Application Logic      │
│ state · validation · totals   │
└──────────────┬────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌──────────────┐  ┌────────────────┐
│  IndexedDB   │  │  Web Crypto    │
│ local data   │  │ backup crypto  │
└──────────────┘  └────────────────┘
       ▲
       │
┌──────┴───────────┐
│  Service Worker  │
│  offline app     │
│  shell caching   │
└──────────────────┘
```

There is no required application server for the current version.

---

## Financial Calculation Model

MONEYLOG stores transaction amounts as integer minor units instead of using floating-point values for stored money.

For an account:

```text
Current Balance
= Opening Balance
+ Income
- Expenses
- Transfers Out
+ Transfers In
```

Transfers do not count as income or expenses.

Example:

```text
Cash  = ৳10,000
Bank  = ৳5,000

Transfer ৳2,000 from Cash → Bank

Cash  = ৳8,000
Bank  = ৳7,000
Total = ৳15,000
```

The money has moved between accounts, but total money has not changed.

---

## Technology

| Area              | Technology                 |
| ----------------- | -------------------------- |
| App type          | Progressive Web App (PWA)  |
| UI                | HTML + CSS                 |
| Application logic | JavaScript                 |
| Local storage     | IndexedDB                  |
| Offline support   | Service Worker             |
| Installation      | Web App Manifest           |
| Backup encryption | Web Crypto API             |
| Default currency  | Bangladeshi Taka (BDT / ৳) |
| Backend           | None                       |
| Authentication    | None required              |

The project is intentionally lightweight and can be hosted as a static website.

---

## Project Structure

```text
moneylog-pwa/
├── index.html         # Application shell
├── styles.css         # Responsive UI
├── app.js             # Application logic and data handling
├── manifest.json      # PWA manifest
├── sw.js              # Offline service worker
├── icon.svg           # Application icon
├── README.md          # Project documentation
└── LICENSE            # MIT License
```

---

## Run Locally

A local server is recommended because service workers require HTTPS or localhost.

### Python

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

You can also use any local development server such as VS Code Live Server.

---

## Deploy

MONEYLOG can be hosted on any suitable HTTPS static host, including:

* GitHub Pages
* Cloudflare Pages
* Netlify
* Vercel static hosting
* Your own HTTPS web server

No backend is required for the current application.

---

## Open Source

MONEYLOG is released as open-source software under the **MIT License**.

You can use it, study it, modify it, self-host it, and build on top of it according to the terms of the license.

Contributions are welcome, especially around:

* Financial calculation correctness
* Data safety
* Backup/restore reliability
* Accessibility
* Performance
* Browser compatibility
* UI/UX improvements
* Automated testing

For financial software, correctness and data integrity should take priority over adding features quickly.

---

## Roadmap

Planned improvements include:

* Advanced transaction filters and date ranges
* Custom category management
* Category-specific budgets
* Savings goals
* Recurring transaction workflows
* Richer reports and trends
* More account-management options
* Stronger automated test coverage
* Improved accessibility
* Additional backup compatibility and migration handling
* Optional browser/device authentication where supported and appropriate
* Further performance and UI refinement

Features should only be described as complete once they are actually implemented and tested.

---

## Current Limitations

The current PWA is intentionally different from a native Android application.

It does **not** provide native Android:

* Android Keystore-backed data protection
* `BiometricPrompt` app locking
* Room/SQLite storage
* Native Android backup APIs

Those are platform-specific native Android capabilities. The PWA instead uses web-platform technologies such as IndexedDB, Service Workers, and Web Crypto.

MONEYLOG also does not connect to banks or process real payments.

---

## Disclaimer

MONEYLOG is a personal record-keeping tool. It does not provide financial, investment, banking, tax, or legal advice.

Always verify important financial information independently.

---

## License

Copyright © 2026 MONEYLOG contributors.

Released under the **MIT License**.

---

## ❤️ Philosophy

> **Your personal financial records should belong to you.**

No forced cloud. No advertising. No payment processing.

Just a simple, transparent tool for keeping track of your money.

---

**MONEYLOG -> Personal Money Journal**
**Your money. Your record. Your control.**
