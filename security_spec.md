# Security Specification - Nexus Dev Marketplace

## Data Invariants
1. A user cannot modify their own `role` field (Privilege Escalation prevention).
2. ONLY the Owner (`tuyginovsardor36@gmail.com`) can promote others to `admin`.
3. The Owner's role is immutable and cannot be changed by anyone (including the owner themselves via client SDK).
4. Users can only edit their own profile fields except `role`.
5. Products can be created by Admins/Owners.
6. Public can read products.

## The "Dirty Dozen" Payloads
1. **Unauth Create Profile**: Anonymous user tries to create a user doc with `role: "owner"`.
2. **Self-Promotion**: Logged-in member tries to update their doc with `role: "admin"`.
3. **Owner Hijack**: User tries to change Owner's email or role.
4. **Data Injection**: User tries to save a 2MB string into a `displayName`.
5. **Orphaned Product**: Create product without a valid `authorId`.
6. **Shadow Field**: Create user doc with extra hidden field `isSuperAdmin: true`.
7. **Timestamp Spoofing**: User sends `createdAt: "2000-01-01"` instead of server time.
8. **PII Leak**: Unauth user tries to list all emails in `/users`.
9. **Admin Lockout**: Admin tries to delete the Owner.
10. **Product Ransom**: Non-admin tries to update product price to $9,999,999.
11. **ID Poisoning**: Use a 2KB string for `userId`.
12. **Cross-User Edit**: User A tries to edit User B's profile.

## Rules Implementation Strategy
- Use `isAdmin()` and `isOwner()` helpers.
- Use `isValidUser()` and `isValidProduct()` validation helpers.
- Enforce `request.time` for timestamps.
- Enforce `affectedKeys().hasOnly()` for updates.
