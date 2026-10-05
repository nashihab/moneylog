# MONEYLOG data protection

MONEYLOG uses several layers because browser storage can be removed by device cleanup tools.

## Layer 1: encrypted local vault
The working vault is encrypted before it is stored in IndexedDB.

## Layer 2: previous safe local snapshot
Before replacing a readable vault record, MONEYLOG keeps the last known-good encrypted copy. This is intended to recover from an interrupted or damaged local write.

## Layer 3: persistent storage
MONEYLOG requests persistent browser storage where the browser supports it. This reduces normal storage eviction but does not override an explicit site-data wipe.

## Layer 4: protected `.moneylog` file
Data Shield writes an encrypted recovery file to a location you choose. The file can be kept outside browser storage and restored after a site-data cleanup. On supported browsers MONEYLOG can update this file automatically after changes.

For important records, keep the protected file in a separate location from the device running MONEYLOG.
