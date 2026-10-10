# MONEYLOG Data Protection

MONEYLOG keeps its financial vault in local browser storage and supports encrypted recovery files. This model avoids a required cloud account, but local storage remains governed by the browser, operating system, and device lifecycle.

## Storage components

### Encrypted primary vault

The financial state is encrypted before being stored in IndexedDB. The current application derives encryption keys using PBKDF2 with SHA-256 and uses AES-GCM authenticated encryption through the Web Crypto API. The active session key is held for the unlocked application session and removed from application state when explicitly locked or when the configured lock behavior expires the session.

### Previous safe copy

Before a new readable vault replaces the primary record, MONEYLOG can preserve the previous encrypted vault record. This provides a local recovery point when the latest write is missing or cannot be decrypted. It is a recovery aid rather than a substitute for an independent backup.

### Browser storage persistence

Where supported, the app requests persistent storage to reduce the chance of automatic storage eviction. This request may be declined, and it does not prevent explicit site-data deletion, browser profile removal, or device failure.

### External protected file

A password-protected `.moneylog` file can be saved outside browser storage. Supported browsers may allow MONEYLOG to keep a selected file handle and update the file after successful vault saves. Other browsers use the downloaded encrypted-backup workflow.

The protected file contains encrypted data and key-recovery material protected by a password. It should be stored separately from the browser profile and handled as sensitive data.

## Recovery workflow

1. Open MONEYLOG and select the protected-file restore flow.
2. Select the appropriate `.moneylog` file.
3. Enter the password associated with that protected file.
4. Allow MONEYLOG to verify and decrypt the contents.
5. Review and confirm replacement of the current local vault.

An invalid password, corrupted file, or incompatible file must be rejected instead of silently replacing data. A protected external file is particularly important before browser cleanup or device migration.

## Limits

- Installed PWAs do not have immunity from explicit deletion of site data.
- Persistent storage can reduce automatic eviction but is not a backup.
- The previous safe copy is stored in the same browser storage and can be lost with it.
- Password and recovery code are local recovery mechanisms, not server-managed credentials.
- A compromised device, malicious browser extension, or unlocked session can expose information.
- If every copy of the vault is deleted and no usable encrypted backup or recovery material remains, recovery may be impossible.

For important records, maintain an independently stored encrypted backup and verify periodically that the password and restore path work.
