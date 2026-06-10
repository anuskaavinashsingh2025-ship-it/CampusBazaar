# Ban User Debug Guide - Real Update Result Logging

## What Changed

The BanModal now captures the **actual UPDATE result** with `.select()` to show exactly which rows were modified.

**New Log Sequence:**
```
1. [BanModal] ADMIN USER CONTEXT: {adminUserId, adminEmail}
2. [BanModal] BEFORE UPDATE: {reportId, targetType, reporterId, sellerUserId, finalUserIdBeingBanned, updatePayload}
3. [BanModal] Executing UPDATE query with .select() to capture rows...
4. [BanModal] UPDATE RESULT: {data, error, count, status}
5. (SUCCESS) [BanModal] UPDATE succeeded - rows affected and returned: {updatedProfile}
   OR
   (FAILURE) [BanModal] UPDATE returned 0 rows - WHERE clause matched no rows
   OR
   (ERROR) [BanModal] UPDATE query returned error: {error details}
```

---

## Key Information to Extract From Logs

When you click "Ban User" and check the console, look for these exact values:

### 1. ADMIN USER CONTEXT
```
[BanModal] ADMIN USER CONTEXT:
{
  adminUserId: "12345678-1234-1234-1234-123456789abc",
  adminEmail: "admin@example.com"
}
```
**Check:** Is this the correct admin user? Does this user have admin role?

### 2. BEFORE UPDATE
```
[BanModal] BEFORE UPDATE:
{
  reportId: "report-id",
  targetType: "product" (or seller/rental/food/notes),
  reporterId: "reporter-id",
  sellerUserId: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
  finalUserIdBeingBanned: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
  updatePayload: {
    status: "banned",
    banned_at: "2026-06-09T10:30:00.000Z",
    banned_until: null,  // or future timestamp
    ban_reason: "your reason",
    banned_by: "admin-uuid"
  }
}
```
**Check:** Is `sellerUserId === finalUserIdBeingBanned`? Are they exactly the same?

### 3. UPDATE RESULT - THE CRITICAL ONE
```
[BanModal] UPDATE RESULT:
{
  data: [
    {
      id: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
      email: "seller@example.com",
      status: "banned",
      banned_at: "2026-06-09T10:30:00.000Z",
      banned_until: null,
      ban_reason: "your reason",
      banned_by: "admin-uuid"
    }
  ],
  error: null,
  count: 1,
  status: 200
}
```
**Success Indicators:**
- ✅ `count: 1` (exactly 1 row updated)
- ✅ `error: null` (no error)
- ✅ `status: 200` (HTTP 200 OK)
- ✅ `data` array has 1 item with `status: "banned"`

**Failure Indicators:**
- ❌ `count: 0` → WHERE clause matched 0 rows (profile doesn't exist or RLS blocked it)
- ❌ `error` is not null → Supabase error (see error details below)
- ❌ `status: 406` → 406 Not Acceptable (RLS or content-type issue)

---

## Troubleshooting by Log Output

### SCENARIO 1: UPDATE RESULT shows `count: 0`

**Log:**
```
[BanModal] UPDATE returned 0 rows - WHERE clause matched no rows
{
  reportId: "...",
  sellerUserId: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
  finalUserIdBeingBanned: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
  targetUserIdType: "string",
  targetUserIdLength: 36,
  possibleIssues: [
    "WHERE id='daea7120-15e3-4516-80e5-ab92a0e84a7d' matched 0 rows - profile does not exist",
    "RLS policy blocked the update (admin role check failed)",
    "Database trigger reverted the update",
    "targetUserId is null/undefined"
  ]
}
```

**Diagnosis Steps:**
1. Run in Supabase SQL Editor:
   ```sql
   SELECT id, email, status FROM profiles WHERE id='daea7120-15e3-4516-80e5-ab92a0e84a7d';
   ```
   - ✅ **Profile exists** → RLS policy is blocking the UPDATE
   - ❌ **No row returned** → Profile doesn't exist (wrong user ID)

2. If profile exists, check if admin has role:
   ```sql
   SELECT * FROM user_roles WHERE user_id='<admin-uuid>' AND role='admin';
   ```
   - ✅ **Row found** → Admin role exists
   - ❌ **No row** → User doesn't have admin role

3. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename='profiles' AND cmd='UPDATE';
   ```
   Should show: `"Admins can update any profile"`

---

### SCENARIO 2: UPDATE RESULT shows error

**Log:**
```
[BanModal] UPDATE query returned error:
{
  error: {
    message: "Permission denied",
    details: "...",
    code: "PGRST301",
    hint: null
  },
  errorMessage: "Permission denied",
  errorCode: "PGRST301"
}
```

**Error Code Reference:**
- `PGRST301` → Row-level security policy violation
- `PGRST305` → Invalid or expired JWT
- `42P01` → Table does not exist
- `23505` → Duplicate key value
- Any `403` → Permission denied

**Diagnosis:**
- Run this query with `service_role` key (not user key):
  ```sql
  UPDATE public.profiles
  SET status='banned', banned_at=now(), ban_reason='test'
  WHERE id='daea7120-15e3-4516-80e5-ab92a0e84a7d';
  ```
  - ✅ **Works with service_role** → RLS policy is too restrictive
  - ❌ **Still fails** → Something else (table structure, trigger, etc.)

---

### SCENARIO 3: UPDATE succeeded (count: 1) but database still shows active

**This should NOT happen.** If `count: 1` and `status: 200`, the database MUST have been updated.

**Possible causes:**
1. **Browser cache** → Hard refresh (Ctrl+Shift+R)
2. **Supabase cache** → Run in different browser/incognito
3. **Viewing wrong row** → Verify you're querying `id='daea7120-15e3-4516-80e5-ab92a0e84a7d'`
4. **Multiple profiles with same email** → Check all rows with seller's email

**Verification:**
```sql
-- Check ALL columns for this user
SELECT * FROM profiles WHERE id='daea7120-15e3-4516-80e5-ab92a0e84a7d';

-- Check if row was updated recently
SELECT * FROM profiles 
WHERE id='daea7120-15e3-4516-80e5-ab92a0e84a7d' 
ORDER BY updated_at DESC 
LIMIT 1;

-- Check if there's a trigger reverting the update
SELECT * FROM pg_trigger WHERE tgrelid = 'profiles'::regclass;
```

---

## Complete Expected Flow (Success)

**Console Output:**
```
[BanModal] ADMIN USER CONTEXT: {
  adminUserId: "a1234567-1234-1234-1234-123456789abc",
  adminEmail: "admin@campusbazar.com"
}

[BanModal] BEFORE UPDATE: {
  reportId: "5fc3b202-5ec9-4b00-9346-8caa7602372f",
  targetType: "seller",
  reporterId: "1964107f-0679-49d0-ab1b-add30f6a9964",
  sellerUserId: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
  finalUserIdBeingBanned: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
  updatePayload: {
    status: "banned",
    banned_at: "2026-06-09T10:30:25.123Z",
    banned_until: null,
    ban_reason: "Prohibited items listed",
    banned_by: "a1234567-1234-1234-1234-123456789abc"
  }
}

[BanModal] Executing UPDATE query with .select() to capture rows...

[BanModal] UPDATE RESULT: {
  data: [
    {
      id: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
      email: "seller@example.com",
      status: "banned",
      banned_at: "2026-06-09T10:30:25.123Z",
      banned_until: null,
      ban_reason: "Prohibited items listed",
      banned_by: "a1234567-1234-1234-1234-123456789abc"
    }
  ],
  error: null,
  count: 1,
  status: 200
}

[BanModal] UPDATE succeeded - rows affected and returned: {
  reportId: "5fc3b202-5ec9-4b00-9346-8caa7602372f",
  targetType: "seller",
  reporterId: "1964107f-0679-49d0-ab1b-add30f6a9964",
  sellerUserId: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
  finalUserIdBeingBanned: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
  updatedProfile: {
    id: "daea7120-15e3-4516-80e5-ab92a0e84a7d",
    email: "seller@example.com",
    status: "banned",
    banned_at: "2026-06-09T10:30:25.123Z",
    banned_until: null,
    ban_reason: "Prohibited items listed",
    banned_by: "a1234567-1234-1234-1234-123456789abc"
  }
}

// Success toast appears: "User banned permanently"
```

---

## How to Share Debug Info

When running the test, share these details:

1. **The complete console logs** (copy entire sequence above)
2. **SQL query result:**
   ```sql
   SELECT id, email, status, banned_at, banned_until, ban_reason, banned_by
   FROM profiles
   WHERE id='daea7120-15e3-4516-80e5-ab92a0e84a7d';
   ```
3. **Admin role verification:**
   ```sql
   SELECT * FROM user_roles 
   WHERE user_id='<your-admin-uuid>' 
   AND role='admin';
   ```

---

## New Code Location

**File:** [src/components/admin/ban-modal.tsx](src/components/admin/ban-modal.tsx#L111-L175)

**Key Changes:**
- Line 50: Added admin context logging
- Line 118: Added UPDATE result logging with `.select()`
- Line 137: Check for `count: 0` (0 rows updated)
- Line 154: Log detailed error info
- Line 218: Enhanced catch block error logging
