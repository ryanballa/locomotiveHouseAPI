# User Registration & Appointment Flow

## Overview

The application now automatically registers users in the database when they first sign in through Clerk. No manual configuration needed!

**Key Feature**: Auto-registration happens automatically on **every page load** after sign-in, so users are ready to use ALL endpoints immediately.

## Complete User Flow

### 1. First-Time Sign In

```
User signs in with Clerk
    ↓
Page loads → UserProvider component runs
    ↓
UserProvider checks Clerk metadata for lhUserId
    ↓
lhUserId not found (first time)
    ↓
UserProvider calls /api/user-id automatically
    ↓
API checks if user exists in database (by Clerk ID)
    ↓
User not found
    ↓
API creates user via /api/users/register
    ↓
API stores: { token: clerk_user_id, permission: null }
    ↓
API returns new user ID
    ↓
API updates Clerk metadata: { lhUserId: new_user_id }
    ↓
UserProvider reloads user metadata
    ↓
User can now use ALL endpoints (appointments, addresses, etc.)
```

**This happens automatically on every page after sign-in!**

### 2. Returning User Sign In

```
User signs in with Clerk
    ↓
Page loads → UserProvider component runs
    ↓
UserProvider checks Clerk metadata for lhUserId
    ↓
lhUserId found in metadata (cached)
    ↓
No API call needed
    ↓
User can use ALL endpoints immediately!
```

### 3. Creating an Appointment

```
User fills out appointment form
    ↓
Frontend validates date/time
    ↓
Frontend sends to API:
{
  schedule: "2025-10-17T14:30:00Z",
  duration: 30,
  user_id: lhUserId
}
    ↓
API validates authentication (checkAuth middleware)
    ↓
API validates user has lhUserId (checkUserPermission middleware)
    ↓
API creates appointment in database
    ↓
Success! Appointment created
```

## API Endpoints

### Auto-Registration
- **Endpoint**: `POST /api/users/register`
- **Middleware**: `checkAuth` only (no permission check)
- **Purpose**: Create users on first sign-in
- **Features**:
  - Checks if user already exists
  - Creates new user if needed
  - Updates Clerk metadata automatically
  - Returns user ID

### Regular User Creation (Admin)
- **Endpoint**: `POST /api/users/`
- **Middleware**: `checkAuth` + `checkUserPermission`
- **Purpose**: Manually create users (admin only)
- **Requires**: Existing user with lhUserId

### Appointment Creation
- **Endpoint**: `POST /api/appointments/`
- **Middleware**: `checkAuth` + `checkUserPermission`
- **Requires**: Valid lhUserId in Clerk metadata

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  token TEXT NOT NULL,        -- Clerk user ID
  permission INTEGER NULL     -- References permissions.id
);
```

### Appointments Table
```sql
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  schedule DATE,
  duration INTEGER NOT NULL DEFAULT 3,
  user_id INTEGER NOT NULL   -- References users.id
);
```

## Authentication Flow

### 1. Clerk JWT Token
- User signs in via Clerk
- Clerk issues JWT token
- Frontend gets token via `getToken()`

### 2. API Authentication
- Frontend sends: `Authorization: Bearer {"jwt":"clerk_jwt_token"}`
- API extracts and verifies JWT
- API gets Clerk user ID from verified token

### 3. Permission Check
- API fetches user from Clerk
- Checks `user.privateMetadata.lhUserId`
- If exists → user has permission
- If not exists → 403 Unauthorized

## Troubleshooting

### "User Not Set Up" Button

**Cause**: Frontend couldn't create/fetch lhUserId

**Solutions**:
1. Check browser console for errors
2. Verify API is running and accessible
3. Check CORS settings in API
4. Verify Clerk credentials in .env.local

### 500 Error on Appointment Creation

**Cause**: User doesn't have lhUserId in Clerk metadata

**Solution**: Sign out and sign in again to trigger auto-registration

### "Unauthorized" Error

**Causes**:
1. Invalid JWT token
2. Missing lhUserId in metadata
3. ALLOWED_PARTIES mismatch

**Solutions**:
1. Verify Clerk JWT key in API
2. Check ALLOWED_PARTIES matches Clerk Frontend API
3. Try signing out and in again

## Environment Variables Reference

### Client (.env.local)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

### API (.dev.vars)
```env
DATABASE_URL=postgresql://...
CLERK_JWT_KEY=your_jwt_key
CLERK_PRIVATE_KEY=sk_test_...
WEBHOOK_SECRET=whsec_... (optional)
ALLOWED_ORIGIN=http://localhost:3000
ALLOWED_PARTIES=your-clerk-frontend-api
```

## Key Files

### Frontend
- `/components/user-provider.tsx` - **Auto-registration trigger (runs on every page)**
- `/app/layout.tsx` - Wraps app with UserProvider
- `/app/api/user-id/route.ts` - Auto-registration logic
- `/app/appointments/create/page.tsx` - Appointment form
- `/lib/api.ts` - API client with auth

### Backend
- `/src/index.ts:363` - Auto-register endpoint
- `/src/index.ts:28` - checkAuth middleware
- `/src/index.ts:54` - checkUserPermission middleware
