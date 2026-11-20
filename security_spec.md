# SwxStudios Firestore Security Specification

## 1. Data Invariants
1. A user document (`/users/{userId}`) can only be read, created, or updated by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`), and `uid` must match `request.auth.uid`.
2. PII (`email`) is strictly isolated in `/users/{userId}/private/info` and readable/writable only by the verified owner (`userId`).
3. Connected OAuth account records (`/users/{userId}/connections/{providerId}`) can only be created, read, or deleted by the verified owner (`userId`), and `provider` must belong to the fixed allowlist `['google', 'discord', 'github', 'microsoft', 'twitch']`.
4. Published catalog packages (`/resources/{resourceId}`) are publicly readable (`get`, `list`), but **create**, **full edits**, and **delete** operations are restricted strictly to verified Owner Admins (`request.auth.token.email in ['randellemupas@gmail.com', 'drminemc@gmail.com'] && request.auth.token.email_verified == true`), with `fileExtension` restricted to `['jar', 'zip', 'rar', '7z', 'gz', 'tar']`.
5. Community threads (`/threads/{threadId}`) require `authorId == request.auth.uid` and verified email on creation; `createdAt` and `authorId` are immutable on updates.
6. Replies (`/threads/{threadId}/replies/{replyId}`) require the parent thread to exist (`exists(...)`), `authorId == request.auth.uid`, and `threadId` matching the path `{threadId}`.
7. Verified non-owner members cannot self-assign `isPremium`, `membershipTier`, or `purchasedIds` on `/users/{userId}` create or update; only verified Owner Admins can grant paid/membership tiers after verifying a GCash/PayPal order.
8. Payment proof orders (`/membershipOrders/{orderId}`) require `userId == request.auth.uid` and `status == 'pending'` on create, are readable only by the submitting member or Owner Admins, and can only be approved/declined by Owner Admins.
9. Competitive PvP Tier rankings (`/tierPlayers/{playerId}`) are publicly readable (`get`, `list`), while `create`, `update`, and `delete` require verified Owner Admin (`isOwnerAdmin()`) or verified Tier Admin (`exists(/databases/$(database)/documents/tierAdmins/$(request.auth.uid))`), with `ranks` keys restricted to the 8 PvP modes and values restricted to `HT1..LT5`.
10. Tier Admin roster (`/tierAdmins/{adminUid}`) has zero PII, is readable only by the Owner Admin or the matching `adminUid` (`get`), and can only be listed, created, or deleted by Owner Admins (`isOwnerAdmin()`).
11. Tier Command audit logs (`/tierCommands/{commandId}`) are readable and creatable only by Owner Admins or verified Tier Admins (`executorUid == request.auth.uid` and immutable `update: false`).
12. Public site metrics (`/metrics/site`) only accept `visits: 1` on create and strict `+1` increment (`existing().visits + 1`) on update with `request.time`; arbitrary count overrides and collection listing are denied.
13. Public member & staff profiles (`/publicMembers/{userId}`) store zero PII (no emails), block self-promotion (`role: 'owner' | 'admin'`, `serverRank`, `serverRoles`, or `membershipTier: 'premium' | 'ultimate'`) by non-owners, and allow verified owners to update only their own `displayName`, `avatarUrl`, and `xp`. Only verified Owner Admins may assign `serverRank` and `serverRoles`.
14. Friendships (`/friendships/{friendshipId}`) are strictly readable only by the two participants (`request.auth.uid in resource.data.users`), can only be created with `requesterUid == request.auth.uid`, `recipientUid != request.auth.uid`, `status == 'pending'` (without `blockedBy`), and an existing target member in `/publicMembers/{recipientUid}`. Only `recipientUid` may transition a `pending` request to `accepted` or `declined`; either participant may block a `pending`/`accepted` connection by setting `status == 'blocked'` and `blockedBy == request.auth.uid`; only `blockedBy` may delete a `blocked` record.
15. Player suggestions (`/playerSuggestions/{suggestionId}`) require `suggestedBy == request.auth.uid`, `status == 'pending'`, and valid Minecraft IGN (`^[a-zA-Z0-9_]+$`) on create; only verified Owner Admins or Tier Admins can approve or decline suggestions.

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
13. **Self-promotion to Tier Admin**: `auth: { uid: 'bob', email_verified: true }`, `create('/tierAdmins/bob', ...)` -> DENIED (`isOwnerAdmin()` fails).
14. **Unauthorized PvP rank edit on `/tierPlayers/marlowww`**: `auth: { uid: 'bob', email_verified: true }` (not Owner or Tier Admin) -> DENIED.
15. **Invalid PvP rank or shadow key in `/tierPlayers/steve`**: `ranks: { vanilla: 'GOD1', extraMode: 'HT1' }` -> DENIED (`isValidTierRanksMap` blocks unknown keys and invalid rank strings).
16. **Metric inflation on `/metrics/site`**: `update('/metrics/site', { visits: 999999, updatedAt: serverTimestamp })` -> DENIED (`visits == existing().visits + 1` required).
17. **Self-assignment of `owner`, `serverRank`, or `ultimate` on `/publicMembers/bob`**: `auth: { uid: 'bob', email_verified: true }`, `create('/publicMembers/bob', { role: 'owner', serverRank: 'owner', ... })` -> DENIED.
18. **PII injection on `/publicMembers/bob`**: `{ uid: 'bob', email: 'bob@example.com', ... }` -> DENIED (`hasOnly` blocks `email`).
19. **Sender self-accepting own friend request on `/friendships/alice_bob`**: `auth: { uid: 'alice', email_verified: true }`, `update('/friendships/alice_bob', { status: 'accepted', ... })` where `requesterUid == 'alice'` -> DENIED (`request.auth.uid == existing().recipientUid` required).
20. **Third-party snooping or spoofing on `/friendships/alice_bob`**: `auth: { uid: 'eve', email_verified: true }`, `get('/friendships/alice_bob')` or `create` with `requesterUid: 'alice'` -> DENIED.
21. **Non-staff approving a player suggestion on `/playerSuggestions/sug1`**: `auth: { uid: 'bob', email_verified: true }`, `update('/playerSuggestions/sug1', { status: 'approved', ... })` -> DENIED.
22. **Blocked target bypassing or spoofing block on `/friendships/alice_bob`**: `auth: { uid: 'bob', email_verified: true }` attempting `delete('/friendships/alice_bob')` when `status == 'blocked' && blockedBy == 'alice'`, or setting `blockedBy: 'alice'` -> DENIED.


