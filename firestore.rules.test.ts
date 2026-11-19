// Security Rules Adversarial Test Suite Specification ("Dirty Dozen")
// Verifies Identity, Integrity, PII Isolation, Terminal State Locking, and Referential Integrity
// against firestore.rules when executed with @firebase/rules-unit-testing.

export const dirtyDozenCases = [
  {
    name: '1. Unauthenticated read of orders is denied',
    auth: null,
    operation: 'GET /users/userA/orders/ord-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Cross-tenant PII read of customers is denied',
    auth: { uid: 'userB', email_verified: true },
    operation: 'LIST /users/userA/customers',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Unverified email write of product is denied',
    auth: { uid: 'userA', email_verified: false },
    operation: 'CREATE /users/userA/products/prod-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Identity spoofing (ownerId mismatch) is denied',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userB', id: 'ord-1' },
    operation: 'CREATE /users/userA/orders/ord-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Ghost field injection on quote update is denied',
    auth: { uid: 'userA', email_verified: true },
    payload: { status: 'ACCEPTED', isAdminApproved: true },
    operation: 'UPDATE /users/userA/quotes/q-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Path ID poisoning with invalid characters is denied',
    auth: { uid: 'userA', email_verified: true },
    operation: 'CREATE /users/userA/products/bad$id!@#',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Forged client createdAt timestamp is denied',
    auth: { uid: 'userA', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    operation: 'CREATE /users/userA/quotes/q-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Immutable field tampering (ownerId or createdAt) on product update is denied',
    auth: { uid: 'userA', email_verified: true },
    payload: { ownerId: 'userB' },
    operation: 'UPDATE /users/userA/products/prod-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Terminal state bypass on converted quote is denied',
    auth: { uid: 'userA', email_verified: true },
    existingState: { status: 'CONVERTED' },
    payload: { status: 'DRAFT' },
    operation: 'UPDATE /users/userA/quotes/q-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Terminal state bypass on delivered order is denied',
    auth: { uid: 'userA', email_verified: true },
    existingState: { status: 'DELIVERED' },
    payload: { status: 'PENDING' },
    operation: 'UPDATE /users/userA/orders/ord-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Oversized or invalid non-map items array is denied',
    auth: { uid: 'userA', email_verified: true },
    payload: { items: ['invalid-string-item'] },
    operation: 'CREATE /users/userA/orders/ord-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Orphaned supplier payment referencing missing supplier is denied',
    auth: { uid: 'userA', email_verified: true },
    payload: { supplierId: 'missing-sup-id', amount: 50000 },
    operation: 'CREATE /users/userA/supplierPayments/spay-1',
    expected: 'PERMISSION_DENIED',
  },
];
