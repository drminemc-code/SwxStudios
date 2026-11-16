# SwxStudios Firestore Security Specification

## 1. Data Invariants
1. A user document (`/users/{userId}`) can only be read, created, or updated by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`), and `uid` must match `request.auth.uid`.
2. PII (`email`) is strictly isolated in `/users/{userId}/private/info` and readable/writable only by the verified owner (`userId`).
3. Connected OAuth account records (`/users/{userId}/connections/{providerId}`) can only be created, read, or deleted by the verified owner (`userId`), and `provider` must belong to the fixed allowlist `['google', 'discord', 'github', 'microsoft', 'twitch']`.
4. Published catalog packages (`/resources/{resourceId}`) are publicly readable (`get`, `list`), but **create**, **full edits**, and **delete** operations are restricted strictly to verified Owner Admins (`request.auth.token.email in ['randellemupas@gmail.com', 'drminemc@gmail.com'] && request.auth.token.email_verified == true`), with `fileExtension` restricted to `['jar', 'zip', 'rar', '7z', 'gz', 'tar']`.
5. Community threads (`/threads/{threadId}`) require `authorId == request.auth.uid` and verified email on creation; `createdAt` and `authorId` are immutable on updates.
6. Replies (`/threads/{threadId}/replies/{replyId}`) require the parent thread to exist (`exists(...)`), `authorId == request.auth.uid`, and `threadId` matching the path `{threadId}`.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read on `/users/{userId}`**: `auth: null`, `get('/users/alice')` -> DENIED.
2. **Cross-user PII read on `/users/alice/private/info`**: `auth: { uid: 'bob', email_verified: true }` -> DENIED.
3. **Unverified email write**: `auth: { uid: 'alice', email_verified: false }`, `set('/users/alice', ...)` -> DENIED.
4. **Shadow field injection on `/users/alice`**: `{ uid: 'alice', displayName: 'Alice', xp: 0, isPremium: false, role: 'admin', createdAt: serverTimestamp, updatedAt: serverTimestamp }` -> DENIED (`hasOnly` blocks `role`).
5. **Non-owner resource publish**: `auth: { uid: 'bob', email: 'bob@example.com', email_verified: true }`, `create('/resources/r1', ...)` -> DENIED (`isOwnerAdmin()` fails).
6. **Unverified owner email spoofing on `/resources/r1`**: `auth: { uid: 'attacker', email: 'randellemupas@gmail.com', email_verified: false }`, `create('/resources/r1', ...)` -> DENIED (`email_verified == true` required).
7. **Disallowed executable upload on `/resources/r1`**: `fileExtension: 'exe'` -> DENIED (`fileExtension in ['jar', 'zip', 'rar', '7z', 'gz', 'tar']`).
8. **Malformed path ID injection**: `resourceId = 'r1..hack'` -> DENIED (`isValidId` regex fails).
9. **Client-forged `createdAt` timestamp**: `createdAt: Timestamp(2020-01-01)` -> DENIED (`createdAt == request.time`).
10. **Non-owner resource deletion**: `auth: { uid: 'bob', email: 'bob@example.com', email_verified: true }`, `delete('/resources/r1')` -> DENIED.
11. **Unbounded array poisoning on `/resources/r1`**: `tags` list with 50 items or non-string entry -> DENIED (`tags.size() <= 10` + `tags[0] is string`).
12. **Orphan reply creation**: `create('/threads/nonexistent/replies/r1', ...)` -> DENIED (`exists` check fails).
