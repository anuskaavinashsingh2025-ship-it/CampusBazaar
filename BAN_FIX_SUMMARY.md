# Ban User Flow Fix - Root Cause Analysis & Solution

## ROOT CAUSE IDENTIFIED

**Primary Issue:** The BanModal was not being passed the `onBanned` callback, so after a successful ban update, the admin portal queries were NOT being refetched. This meant:
- The profile update succeeded in the database
- The toast shown success 
- BUT the UI showed stale data because React Query cache was not invalidated

**Secondary Issue:** The `.select().single()` chained after `.update()` could fail under RLS because the UPDATE policy only granted UPDATE permission, not SELECT in the same query chain. While a separate SELECT policy exists for admins, chaining them can cause issues.

---

## EXACT ROOT CAUSE BREAKDOWN

### Problem 1: Missing Callback (PRIMARY)
**File:** [src/routes/_authenticated/admin.tsx](src/routes/_authenticated/admin.tsx#L1142-L1150)

**Before:**
```tsx
<BanModal
  open={banModalOpen}
  onOpenChange={setBanModalOpen}
  targetUserId={banTargetUserId ?? ""}
  targetUserName={banTargetUserName ?? undefined}
  // Missing: reportContext and onBanned
/>
```

**After:**
```tsx
<BanModal
  open={banModalOpen}
  onOpenChange={setBanModalOpen}
  targetUserId={banTargetUserId ?? ""}
  targetUserName={banTargetUserName ?? undefined}
  reportContext={banCurrentReport ? {
    reportId: banCurrentReport.id,
    targetType: banCurrentReport.target_type,
    reporterId: banCurrentReport.reporter_id,
    sellerUserId: banCurrentReport.seller_user_id,
  } : null}
  onBanned={async () => {
    // Refetch all admin queries after successful ban
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
    setBanCurrentReport(null);
  }}
/>
```

### Problem 2: RLS Query Chain Issue (SECONDARY)
**File:** [src/components/admin/ban-modal.tsx](src/components/admin/ban-modal.tsx#L111-L140)

**Before:**
```typescript
const { data: updatedProfile, error } = await supabase
  .from("profiles")
  .update(updatePayload)
  .eq("id", targetUserId)
  .select("id,email,status,banned_at,banned_until,ban_reason,banned_by")
  .single();  // ⚠️ This might fail due to RLS policy chain

if (error) throw error;
```

**After (Separated UPDATE and SELECT):**
```typescript
// Execute UPDATE separately
const { error: updateError } = await supabase
  .from("profiles")
  .update(updatePayload)
  .eq("id", targetUserId);

if (updateError) throw updateError;

// Verify with SEPARATE SELECT query
const { data: verifyProfile, error: selectError } = await supabase
  .from("profiles")
  .select("id,email,status,banned_at,banned_until,ban_reason,banned_by")
  .eq("id", targetUserId)
  .single();

if (selectError) throw selectError;
```

---

## EXACT UPDATE QUERY BEING EXECUTED

After the fix, the ban update executes as:

```sql
-- First: UPDATE (using admin UPDATE policy)
UPDATE public.profiles
SET
  status = 'banned',
  banned_at = now(),
  banned_until = <null for permanent | future_timestamp for temporary>,
  ban_reason = '<admin-provided-reason>',
  banned_by = '<admin-user-id>'
WHERE id = '<seller-user-id>';

-- Then: VERIFY with SELECT (using admin SELECT policy)
SELECT id, email, status, banned_at, banned_until, ban_reason, banned_by
FROM public.profiles
WHERE id = '<seller-user-id>'
LIMIT 1;
```

### Field-by-Field Breakdown:
| Field | Value | Purpose |
|-------|-------|---------|
| `status` | `'banned'` | Mark user account as banned |
| `banned_at` | `now()` | Timestamp of ban application |
| `banned_until` | `null` (permanent) \| future timestamp (temporary) | Expiration date (null = permanent) |
| `ban_reason` | User-provided string | Admin's reason for the ban |
| `banned_by` | UUID of admin user | Who performed the ban |

---

## FILES CHANGED

### 1. [src/routes/_authenticated/admin.tsx](src/routes/_authenticated/admin.tsx)
**Changes:**
- Added state: `const [banCurrentReport, setBanCurrentReport] = useState<ReportRow | null>(null);` (line 107)
- Updated "Ban Seller" button to store current report (line 835)
- Updated BanModal component to pass `reportContext` and `onBanned` (lines 1142-1154)

### 2. [src/components/admin/ban-modal.tsx](src/components/admin/ban-modal.tsx)
**Changes:**
- Separated UPDATE and SELECT queries to avoid RLS policy chain issues (lines 111-165)
- Added detailed logging of update query being executed (line 118)
- Added separate verification SELECT after UPDATE (lines 127-164)
- Enhanced error messages with more context (lines 119-168)

---

## VERIFICATION STEPS

### Step 1: Check Browser Console
When clicking "Ban User":
- Look for `[BanModal] Updating profile ban status` - shows the exact query
- Look for `[BanModal] Update completed, verifying persistence...`
- Look for `[BanModal] Profile ban update succeeded and verified` - SUCCESS

If you see errors, they will be logged with full context.

### Step 2: Check Database Directly
```sql
-- Run this in Supabase SQL Editor to verify the ban was applied:
SELECT 
  id,
  email,
  status,
  banned_at,
  banned_until,
  ban_reason,
  banned_by
FROM profiles
WHERE id = '<seller-user-id-here>'
ORDER BY updated_at DESC
LIMIT 1;
```

Expected result:
- `status` = `'banned'`
- `banned_at` = recent timestamp
- `banned_until` = `null` (for permanent) or future timestamp
- `ban_reason` = the reason provided
- `banned_by` = the admin's user ID

### Step 3: Verify Report Queue Updates
After clicking "Ban User" and seeing success toast:
1. The report should refresh (refetch is called via `queryClient.invalidateQueries`)
2. The seller's profile status should show as "banned"
3. The banned_at timestamp should appear in the seller details modal

### Step 4: Test Permanent vs Temporary Ban
- **7 days:** `banned_until` should be 7 days from now
- **30 days:** `banned_until` should be 30 days from now
- **90 days:** `banned_until` should be 90 days from now
- **Permanent:** `banned_until` should be `null`

---

## LOGGING ADDED FOR DEBUGGING

All these logs will appear in the browser DevTools Console (F12):

### Pre-Submission Validation
```
[BanModal] Missing target user id {reportId, targetType, reporterId, sellerUserId, finalUserIdBeingBanned}
[BanModal] Refusing to ban non-seller target {reportId, targetType, reporterId, sellerUserId, finalUserIdBeingBanned}
```

### Update Process
```
[BanModal] Updating profile ban status {
  reportId,
  targetType,
  reporterId,
  sellerUserId,
  finalUserIdBeingBanned,
  updatePayload,
  query: "exact SQL being executed"
}
[BanModal] Update completed, verifying persistence... {targetUserId}
[BanModal] Profile ban update succeeded and verified {
  reportId,
  targetType,
  reporterId,
  sellerUserId,
  finalUserIdBeingBanned,
  verifyProfile: {id, email, status, banned_at, banned_until, ban_reason, banned_by}
}
```

### Error Cases
```
[BanModal] Profile update failed with error {error details}
[BanModal] Failed to verify ban persistence {error details}
[BanModal] Profile update did not persist ban fields {verifyProfile}
```

---

## RLS POLICIES IN EFFECT

These policies (from [20260604000000_profile_admin_rls.sql](supabase/migrations/20260604000000_profile_admin_rls.sql)) enable this to work:

```sql
-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update any profile (for ban, suspend, etc.)
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

The `public.has_role()` function checks if a user has the 'admin' role in the user_roles table.

---

## KEY VALIDATION IN BAN MODAL

1. **Missing User ID Check:**
   ```typescript
   if (!targetUserId) {
     toast.error("Cannot ban user: missing target user id.");
     // ... log with full context
     return;
   }
   ```

2. **Seller ID Mismatch Check:**
   ```typescript
   if (reportContext && targetUserId !== reportContext.sellerUserId) {
     toast.error("Cannot ban user: selected target is not the reported seller.");
     // Prevents accidentally banning the wrong person
     return;
   }
   ```

3. **Reason Required Check:**
   ```typescript
   if (!reason.trim()) {
     toast.error("Please provide a reason for the ban");
     return;
   }
   ```

4. **Persistence Verification:**
   ```typescript
   if (!verifyProfile || verifyProfile.status !== "banned" || !verifyProfile.banned_at) {
     throw new Error(`Ban update did not persist. Profile status: ${verifyProfile?.status}, banned_at: ${verifyProfile?.banned_at}`);
   }
   ```

---

## WHAT HAPPENS AFTER SUCCESSFUL BAN

1. **Admin action is logged:**
   ```typescript
   await supabase.from("admin_actions").insert({
     admin_user_id: user.id,
     action_type: "ban_user",
     target_user_id: targetUserId,
     notes: `Banned for ${duration}: ${reason}`
   });
   ```

2. **Success toast is shown:**
   ```
   "User [name] banned [permanently|for X days]"
   ```

3. **Cache is invalidated:**
   ```typescript
   await queryClient.invalidateQueries({ queryKey: ["admin"] });
   ```
   This triggers refetch of:
   - Reports
   - Report profiles
   - Analytics (banned users count)

4. **Modal closes and state resets:**
   ```typescript
   onOpenChange(false);
   setReason("");
   setDuration("7");
   setBanCurrentReport(null);
   ```

---

## SUMMARY

**What was broken:** Ban updates succeeded in DB but UI didn't reflect changes due to missing cache invalidation callback.

**What was fixed:**
1. ✅ Pass `reportContext` to BanModal (for enhanced logging)
2. ✅ Pass `onBanned` callback to trigger cache invalidation
3. ✅ Separate UPDATE and SELECT queries to handle RLS properly
4. ✅ Enhanced error messages with specific context
5. ✅ Added verification that ban actually persisted

**Result:** Clicking "Ban User" now properly updates the profile AND refreshes the UI to show the change immediately.
