# Security Specification — BOUTIKPRO Firestore Architecture

## 1. Data Invariants & Master Source of Truth
- **Master Source of Truth**: `/users/{userId}` with `ownerId == request.auth.uid`. Every private business subcollection (`profile`, `products`, `orders`, `quotes`, `customers`, `promoLogs`, `stockMovements`, `suppliers`, `supplierPayments`, `sellerPayouts`) lives strictly under `/users/{userId}/...` and carries `ownerId == userId`.
- **Public Storefront Projection**: `/publicStores/{storeSlug}` and `/publicStores/{storeSlug}/products/{productId}` expose strictly non-sensitive storefront data (delivery rates, tax rate, enabled payment methods, online products with `isOnline == true`). Merchant `email`, `ifuNumber`, and product `buyPrice` / `sku` are never written to `/publicStores`. `allow list: if false` prevents store directory scraping on `/publicStores`, and `allow list: if resource.data.isOnline == true` constrains product listing to online items only.
- **Identity & Verification**: All private reads and all writes require `request.auth != null && request.auth.token.email_verified == true` and strict ownership (`request.auth.uid == userId`).
- **Immutability & Temporal Integrity**: `ownerId` and `createdAt` (`request.time`) are immutable after creation; `updatedAt` MUST equal `request.time` on both `create` and `update`.
- **Terminal State Locking**:
  - Once a `Quote` reaches `status == 'CONVERTED'`, no further updates are allowed (preventing double-conversion or tampering with converted quotes).
  - Once an `Order` reaches `status == 'DELIVERED'` or `status == 'CANCELLED'`, its status/totals are locked from tampering.
- **Referential Integrity**:
  - Every subcollection `create` verifies `exists(/databases/$(database)/documents/users/$(userId))`.
  - Every `SupplierPayment` creation verifies `exists(/databases/$(database)/documents/users/$(userId)/suppliers/$(incoming().supplierId))`.
- **PII Isolation**: Customer phone numbers, delivery addresses, merchant email/IFU, and supplier contacts are isolated per-owner under `/users/{userId}/...`. No blanket `isSignedIn()` reads or list queries exist anywhere.

## 2. The "Dirty Dozen" Adversarial Test Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated Read/Write**: Read `/users/userA/orders/ord-1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Cross-Tenant PII Leak**: Authenticated `userB` attempts `get` or `list` on `/users/userA/customers` -> `PERMISSION_DENIED`.
3. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempts to create `/users/userA/products/prod-1` -> `PERMISSION_DENIED`.
4. **Identity Spoofing on Create**: `userA` creates `/users/userA/orders/ord-1` with `ownerId: "userB"` -> `PERMISSION_DENIED`.
5. **Ghost / Shadow Field Injection**: `userA` updates `/users/userA/quotes/q-1` adding an undeclared field `isAdminApproved: true` -> `PERMISSION_DENIED`.
6. **Path ID Poisoning**: `userA` creates `/users/userA/products/invalid!@#id_too_long...` -> `PERMISSION_DENIED`.
7. **Client Timestamp Forgery**: `userA` creates `/users/userA/quotes/q-1` with a hardcoded past `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
8. **Immutable Field Tampering**: `userA` updates `/users/userA/products/prod-1` attempting to mutate `createdAt` or `ownerId` -> `PERMISSION_DENIED`.
9. **Terminal State Bypass (Quote)**: `userA` updates a quote whose `existing().status == 'CONVERTED'` to reset `status` back to `'DRAFT'` -> `PERMISSION_DENIED`.
10. **Terminal State Bypass (Order)**: `userA` updates an order whose `existing().status == 'DELIVERED'` to change `totalAmount` -> `PERMISSION_DENIED`.
11. **Unbounded Array / Resource Exhaustion**: `userA` sends an `Order` with `items` of 150 items or invalid non-map element `items: ["bad"]` -> `PERMISSION_DENIED`.
12. **Orphaned Supplier Payment**: `userA` creates a `SupplierPayment` referencing a non-existent `supplierId: "sup-missing"` -> `PERMISSION_DENIED`.
