# Quick Reference: Address API Changes

## What Changed?

### 1. ✅ Permission Checks Added
All address endpoints now validate:
- User authentication (JWT token)
- User permissions (lhUserId)
- User ownership (non-admins only)
- Club membership (non-admins only)

### 2. ✅ Club-Based Uniqueness
Address numbers are now unique **per club**, not globally:
- Same number can exist in different clubs
- Prevents duplicates within each club
- Requires `club_id` in all requests

### 3. ✅ Comprehensive Tests (80 passing)
- Model unit tests (17)
- Endpoint integration tests (35)
- Authorization tests (28)

---

## API Endpoint Changes

### POST /api/addresses/

**New Requirements:**
```json
{
  "number": 3,
  "description": "Engine Service",
  "in_use": true,
  "user_id": 1,
  "club_id": 2      // ← NOW REQUIRED
}
```

**New Validation:**
- User must be assigned to the club
- Address number must be unique in that club
- Non-admins can only create for themselves

**Error Responses:**
```
400 - Missing required field: club_id
403 - Unauthorized: You can only create addresses for yourself
403 - Unauthorized: You are not assigned to this club
400 - Address number 3 already exists in this club
```

---

### PUT /api/addresses/:id

**New Requirements:**
```json
{
  "number": 5,
  "description": "Updated Service",
  "in_use": true,
  "user_id": 1,
  "club_id": 2      // ← NOW REQUIRED
}
```

**New Validation:**
- User must be assigned to the target club
- Address number must be unique in that club (excluding current address)
- Non-admins can only edit their own addresses

**Error Responses:**
```
404 - Address not found
400 - Missing required field: club_id
403 - Unauthorized: You can only edit your own addresses
403 - Unauthorized: You are not assigned to this club
400 - Address number 3 already exists in this club
```

---

### DELETE /api/addresses/:id

**New Validation:**
- Non-admins can only delete their own addresses
- Admins can delete any address

**Error Responses:**
```
404 - Address not found
403 - Unauthorized: You can only delete your own addresses
```

---

## Testing

### Run All Tests
```bash
npm test -- --run
```

### Run Specific Test File
```bash
npm test test/addresses.model.test.ts -- --run
```

### Run with Pattern
```bash
npm test -- --run -t "Per-Club"
```

### Test Results
```
✅ 80 tests passing
- addresses.model.test.ts: 17 tests
- addresses.endpoints.test.ts: 35 tests
- addresses.auth.test.ts: 28 tests
```

---

## User Scenarios

### Admin User
```
✅ Can create address for any user in any club
✅ Can edit any address
✅ Can delete any address
✅ Bypasses club membership checks
```

### Regular User (Single Club)
```
✅ Create address 003 in their club
❌ Cannot create address 004 by another user
✅ Can edit their own address 003
❌ Cannot edit another user's address
✅ Can delete their own address
❌ Cannot delete another user's address
```

### Regular User (Multiple Clubs)
```
✅ Create address 003 in Club A
✅ Create address 003 in Club B (SAME NUMBER, DIFFERENT CLUB)
❌ Cannot create another 003 in Club A (BLOCKED)
✅ Can edit or delete addresses in both clubs
❌ Cannot access addresses in clubs they're not in
```

---

## Database Changes

### Migration Applied
```sql
ALTER TABLE "addresses" ADD COLUMN "club_id" integer NOT NULL;
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_club_id_clubs_fk"
  FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id");
```

### Schema Updated
- `addresses` table now has `club_id` field
- Foreign key constraint to `clubs` table
- Address uniqueness is per-club, not global

---

## Code Files Modified

### `/src/index.ts`
- Line 17: Added `and` import
- Lines 184-279: Updated POST /api/addresses/
- Lines 281-392: Updated PUT /api/addresses/:id
- Lines 394-447: Updated DELETE /api/addresses/:id

### `/src/db/schema.ts`
- Lines 13-15: Added `club_id` to addresses table

### `/src/addresses/model.ts`
- Lines 1-3: Updated imports
- Lines 5-12: Updated Address interface
- Lines 19-61: New `checkIfAddressNumberExistsInClub()` function
- Lines 78-116: Updated `createAddress()`
- Lines 118-167: Updated `updateAddress()`

---

## New Files Created

| File | Purpose |
|------|---------|
| `test/addresses.model.test.ts` | Unit tests for model functions (17 tests) |
| `test/addresses.endpoints.test.ts` | Endpoint integration tests (35 tests) |
| `test/addresses.auth.test.ts` | Authorization tests (28 tests) |
| `TEST_DOCUMENTATION.md` | Complete test guide |
| `IMPLEMENTATION_SUMMARY.md` | Full implementation details |
| `QUICK_REFERENCE.md` | This file |

---

## Key Differences

### Before
```
- Address numbers unique globally
- No club_id field
- No permission validation at endpoints
- No tests
```

### After
```
- Address numbers unique per club ✅
- club_id required field ✅
- Full permission validation (auth, ownership, club membership) ✅
- 80 comprehensive tests ✅
```

---

## Common Questions

**Q: Can I still have address 003 in multiple clubs?**
A: Yes! Address 003 can be in Club A and Club B, just not twice in Club A.

**Q: What if I'm an admin?**
A: You can create addresses in any club without membership checks.

**Q: Do I need to migrate my database?**
A: Yes, run `npm run db:migrate` to apply the schema change.

**Q: What happens with existing addresses?**
A: You must assign each existing address to a club via a migration script.

**Q: Are there any breaking changes?**
A: Yes - `club_id` is now required in all POST and PUT requests.

---

## Migration Path

1. **Database**: `npm run db:migrate` (adds club_id column)
2. **Data**: Assign existing addresses to clubs (manual or script)
3. **API**: Start using `club_id` in all address requests
4. **Tests**: Run `npm test -- --run` to verify everything works
5. **Deploy**: `npm run deploy` when ready

---

## Troubleshooting

### "Missing required field: club_id"
Add `club_id` to your request body

### "Unauthorized: You are not assigned to this club"
Make sure the user is assigned to the club in `users_to_clubs` table

### "Address number 3 already exists in this club"
This address number is already taken in this club, use a different number

### Tests failing on `npm test`
Use `npm test -- --run` to run without watch mode

---

## Reference Documentation

- **Full Details**: See `IMPLEMENTATION_SUMMARY.md`
- **All Tests**: See `TEST_DOCUMENTATION.md`
- **Test Code**: See `test/addresses.*.test.ts` files

---

**Last Updated**: October 21, 2025
**Status**: Production Ready ✅

