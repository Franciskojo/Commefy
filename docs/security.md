# StoreForge Application Security Architecture & Threat Model

## 1. Multi-Tenant Threat Model & Defenses

StoreForge is engineered to resist cross-tenant data leakage, privilege escalation, credential theft, and payment tampering in a multi-tenant SaaS environment.

```
                           +---------------------------+
                           |  Next.js Edge Proxy Layer |
                           |  - Host Classification    |
                           |  - Header Sanitization    |
                           |  - OWASP Security Headers |
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           | Server Actor Auth Context |
                           | - requirePlatformStaff()  |
                           | - requireTenantStaff()    |
                           | - requireCustomer()       |
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           |   TenantScopedCollection  |
                           | - Injects { tenantId }    |
                           | - Forbids tenantId edits  |
                           | - Blocks cross-coll stages|
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           |  MongoDB Compound Indexes |
                           |  { tenantId: 1, ... }     |
                           +---------------------------+
```

---

## 2. Authentication Architecture

### Password Hashing (Argon2id)
- **Algorithm**: Argon2id via `@node-rs/argon2`
- **OWASP Recommended Parameters**:
  - Memory cost: 19 MiB (19,456 KiB)
  - Time cost: 2 iterations
  - Parallelism: 1 thread
  - Output length: 32 bytes
- **Timing Attack Mitigation**: When a non-existent email is entered during sign-in, the system runs an identical Argon2id verification against a precomputed dummy hash (`verifyDummyPassword()`), preventing user enumeration via response timing variance.

### Multi-Factor Authentication (RFC 6238 TOTP)
- **TOTP Algorithm**: HMAC-SHA1 with 30-second time-steps and 6-digit verification codes.
- **Clock Drift**: 1-step window (`t-30s` to `t+30s`) accommodating network latency and minor device clock variance.
- **Secret Encryption**: The 20-byte base32 secret is encrypted at rest using AES-256-GCM with tenant-bound authenticated data (`user:${userId}:totp`).
- **Emergency Recovery Keys**: 10 single-use `xxxx-xxxx` recovery codes are generated upon enrollment. Hashes are stored as SHA-256; consuming a recovery code permanently invalidates that hash.

### Session Engine & Immediate Revocation
- **Storage**: Sessions are stored in the database keyed by the SHA-256 hash of a cryptographically random 32-byte token (`crypto.randomBytes(32)`).
- **Dual Expiration**:
  - Sliding idle timeout: 7 days for staff, 30 days for customers.
  - Absolute timeout: 30 days for staff, 90 days for customers.
- **Immediate Invalidation**: Changing passwords or revoking staff access triggers `invalidateAllUserSessions(userId)`, immediately terminating active sessions across all devices.

---

## 3. Cryptographic Envelope Encryption (AES-256-GCM)

All third-party payment gateway secrets (Stripe secret keys, Paystack secret keys, webhook secrets) are encrypted before writing to persistent storage.

- **Algorithm**: AES-256 in Galois/Counter Mode (GCM).
- **IV / Nonce**: 12 random bytes generated uniquely per encryption operation.
- **Authentication Tag**: 16-byte authentication tag verifying data integrity.
- **Associated Authenticated Data (AAD)**: Encrypted payloads bind the tenant ID into the AAD string (e.g. `tenant:${tenantId}:secretKey`). If an attacker copies an encrypted ciphertext block from Tenant A to Tenant B, decryption under Tenant B fails due to AAD mismatch.
- **Key Rotation**: The payload structure records `{ keyId, iv, ciphertext, tag }`. The system supports secondary decryption keys via `DATA_ENCRYPTION_PREVIOUS_KEYS` to enable zero-downtime key rotation.

---

## 4. Payment Gateway Webhook Verification

Incoming payment notifications from Stripe, Paystack, and the Mock gateway are authenticated against cryptographic forgery:

1. **HMAC Signature Verification**:
   - Webhook endpoints read the raw byte body (`request.text()`) before any JSON parsing.
   - Computes expected HMAC signature using the tenant's decrypted webhook secret.
   - Evaluates equality using `crypto.timingSafeEqual` to neutralize timing side-channel attacks.
2. **Anti-Replay & Idempotency**:
   - Incoming webhook events are recorded in `webhookEvents` with a compound unique index on `{ provider: 1, eventId: 1 }`.
   - If an event is retransmitted by the gateway, the database insert rejects the duplicate event or returns the previously cached fulfillment status.

---

## 5. File Upload & Magic-Byte Asset Sniffing

To prevent arbitrary script execution or malicious SVG attacks:
- **Sniffing by Magic Bytes**: File headers are inspected for authentic binary signatures (JPEG: `\xFF\xD8\xFF`, PNG: `\x89PNG\r\n\x1a\n`, WebP: `RIFF....WEBP`, GIF: `GIF87a`/`GIF89a`).
- **SVG Prohibition**: Vector graphics (`.svg`) are rejected to prevent stored Cross-Site Scripting (XSS).
- **Size Limits**: Enforced strictly up to 5 MB per asset.
