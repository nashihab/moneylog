# MONEYLOG file structure

MONEYLOG is a static PWA, so the GitHub Pages entry points stay at the project root. Runtime assets are grouped under `assets/`.

- `index.html` - app entry point
- `manifest.json` - install metadata
- `sw.js` - offline cache and update handoff
- `version.json` - published release information
- `assets/app.js` - application logic and storage
- `assets/styles.css` - UI styling
- `assets/icon.svg` - vector application icon
- `assets/icon-192.png` - install icon
- `assets/icon-512.png` - install and splash icon
- `docs/` - project documentation
- `README.md` - GitHub project overview

User backup files are not stored in the repository. Keep your `.moneylog` recovery file outside the browser and outside the project folder.
