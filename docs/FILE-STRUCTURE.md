# MONEYLOG File Structure

The repository is organized so GitHub Pages can deploy it directly without a build step.

```text
MONEYLOG/
├── index.html          Application entry point
├── demo.html           Read-only demo entry point
├── manifest.json       PWA manifest
├── sw.js               Service worker and offline cache
├── version.json        Public release metadata used by update checks
├── README.md           Project documentation
├── LICENSE             Source-available usage terms
├── assets/
│   ├── app.js          Application logic and state handling
│   ├── styles.css      Application UI styles
│   ├── icon.svg        Vector app icon
│   ├── icon-192.png    PWA installation icon
│   └── icon-512.png    PWA installation icon
└── docs/
    ├── DATA-PROTECTION.md
    └── FILE-STRUCTURE.md
```

Do not move `index.html`, `manifest.json`, `sw.js`, or `version.json` away from the root
without also changing deployment paths and the service-worker scope.
