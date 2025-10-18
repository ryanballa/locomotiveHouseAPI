# Auto-Registration System

## How It Works

The app uses a **UserProvider** component that automatically registers users when they sign in.

### Trigger Points

Auto-registration triggers automatically on **every page load** when:
1. User is signed in via Clerk
2. User doesn't have `lhUserId` in Clerk metadata

### Component: UserProvider

Located at: `/components/user-provider.tsx`

```typescript
export function UserProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    // Auto-register user on sign-in if they don't have lhUserId
    const ensureUserRegistered = async () => {
      if (!isSignedIn || !user) return;

      const lhUserId = user.privateMetadata?.lhUserId;

      if (!lhUserId) {
        // Calls /api/user-id which triggers registration
        const response = await fetch('/api/user-id');
        const data = await response.json();

        if (data.lhUserId) {
          await user.reload(); // Refresh metadata
        }
      }
    };

    ensureUserRegistered();
  }, [isSignedIn, user]);

  return <>{children}</>;
}
```

### Integration

The UserProvider wraps the entire app in `/app/layout.tsx`:

```typescript
<ClerkProvider>
  <UserProvider>
    {children}
  </UserProvider>
</ClerkProvider>
```

## Benefits

### 1. Universal Coverage
- Works for **all endpoints** automatically
- No need to call registration in each page/component
- Users are ready to use ANY feature immediately

### 2. Seamless Experience
- Happens in the background
- No loading states or user interaction required
- Silent failure handling (logs errors, doesn't block UI)

### 3. Efficient
- Only runs once per session (cached in Clerk metadata)
- Skips check if `lhUserId` already exists
- Minimal performance impact

## Endpoint Coverage

With auto-registration, users can immediately use:

✅ **Appointments** (`POST /api/appointments/`)
- checkAuth ✓
- checkUserPermission ✓ (lhUserId set)

✅ **Addresses** (`POST /api/addresses/`)
- checkAuth ✓
- checkUserPermission ✓ (lhUserId set)

✅ **Consists** (`POST /api/consists/`)
- checkAuth ✓
- checkUserPermission ✓ (lhUserId set)

✅ **Users** (Admin operations via `POST /api/users/`)
- checkAuth ✓
- checkUserPermission ✓ (lhUserId set)

## Adding New Endpoints

When creating new endpoints that use `checkUserPermission`:

1. **No changes needed!** Auto-registration already handles it
2. User will have `lhUserId` in metadata
3. Endpoint will work immediately

### Example: New Feature

```typescript
// Backend - New endpoint
app.post('/api/new-feature/', checkAuth, checkUserPermission, async (c) => {
  // This will work automatically!
  // User has lhUserId from auto-registration
  const db = dbInitalizer({ c });
  // ... your logic
});

// Frontend - Just use it
const createFeature = async (data) => {
  const token = await getToken();
  const response = await apiClient.createFeature(data, token);
  // Works immediately, no manual registration needed!
};
```

## Troubleshooting

### User still gets "Unauthorized"

**Check**:
1. Is UserProvider wrapping the app in layout.tsx?
2. Is user signed in? (check with `useAuth()`)
3. Check browser console for auto-registration errors

**Debug**:
```javascript
// In browser console
console.log(user?.privateMetadata?.lhUserId);
// Should show a number (user ID from database)
```

### Auto-registration fails silently

**Causes**:
- API is down or unreachable
- CORS issues
- Database connection issues

**Solution**:
- Check browser Network tab
- Look for failed `/api/user-id` request
- Check API logs for errors

### Want to disable auto-registration?

Comment out the UserProvider in `/app/layout.tsx`:

```typescript
// <UserProvider>
  {children}
// </UserProvider>
```

Then manually call `/api/user-id` where needed.

## Performance Considerations

### Runs on Every Page Load
- Only makes API call if `lhUserId` is missing
- Cached in Clerk metadata after first registration
- Subsequent loads: just a metadata check (no API call)

### Network Impact
- First load: 1 extra API call to `/api/users/register`
- All other loads: 0 API calls
- Metadata check is local (no network)

### Optimization Tips
1. Use Clerk webhooks in production for proactive registration
2. UserProvider skips if user already registered (efficient check)
3. Runs in background (doesn't block page render)
