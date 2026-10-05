# MONEYLOG Data Protection

MONEYLOG uses local browser storage by design. That gives the app privacy and offline
behavior, but it also means browser storage is part of the device's storage lifecycle.

## The protection layers

### 1. Encrypted primary vault

The current vault is encrypted before it is written to IndexedDB. The active session key
exists only for the current unlocked session.

### 2. Previous safe vault record

Before the current encrypted vault is replaced, MONEYLOG keeps the previous encrypted
record under a separate key. This is intended to provide a recovery point for a failed or
corrupted latest write.

### 3. Persistent browser storage

MONEYLOG requests persistent storage where the browser exposes the StorageManager API.
Persistent storage can reduce automatic eviction. It does not make browser data immune
to explicit site-data deletion, browser reset, or profile removal.

### 4. External recovery file

The protected `.moneylog` file is the important recovery layer for browser cleanup. On
supporting browsers, the File System Access API lets MONEYLOG remember the selected file
and update it after successful vault saves.

The external file is encrypted with MONEYLOG's vault key and additionally stores a
password-wrapped copy of that key so the file can be restored independently.

## What Data Shield does not claim

Data Shield does not claim to make the browser database indestructible. A deliberate
browser cleanup can still remove IndexedDB, local storage, service-worker caches, and
other origin data.

For durable recovery, keep at least one protected `.moneylog` file outside the browser
profile and outside the device location you are trying to protect.

## Safe recovery workflow

1. Keep Data Shield enabled.
2. Keep the protected `.moneylog` file in a separate location.
3. After a site-data reset, open MONEYLOG and choose Restore protected MONEYLOG.
4. Enter the password used when the protected file was created.
5. Confirm the restore before the local vault is replaced.

## Best practice

For records that matter, keep more than one backup location. MONEYLOG is a local-first
web application, not a cloud backup service.
