# Setup Guide - Auto User Registration

The app now automatically handles user registration! No manual setup required.

## How It Works

When a user signs in for the first time:

1. **Frontend checks** if user exists in database (via Clerk metadata)
2. **If not found**, calls `/api/users/register` endpoint
3. **API creates user** in database with Clerk ID as the `token`
4. **API updates** Clerk metadata with `lhUserId`
5. **User can immediately** create appointments

## No Configuration Needed

The auto-registration flow works out of the box. Users are automatically set up on first sign-in!

## Optional: Webhook Setup (For Production)

For better reliability in production, consider setting up Clerk webhooks:

### Step 1: Set Up Clerk Webhook

1. **In Clerk Dashboard:**
   - Go to "Webhooks"
   - Click "Add Endpoint"
   - Enter your API URL: `https://your-api-url.com/api/webhooks/`
   - Subscribe to events:
     - `user.created`
     - `user.deleted`
   - Copy the "Signing Secret"

2. **In your API `.dev.vars`:**
   ```
   WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

This creates users in the background when they sign up. The auto-registration flow still works as a fallback.

## Manual User Creation (For Admins Only)

If you need to manually create users with specific permissions:

1. **Use the admin endpoint:**
   ```bash
   POST /api/users/
   ```
   (Requires existing user with `lhUserId` in metadata)

2. **Or use the database directly:**
   ```sql
   INSERT INTO users (token, permission)
   VALUES ('clerk_user_id_here', permission_id);
   ```

## Testing the Fix

After completing the setup:

1. Sign in to the app
2. Go to "Create Appointment"
3. You should see "User ID: X" in the appointment details
4. If you see "User Not Set Up", the `lhUserId` is not set in Clerk metadata
5. Try creating an appointment - it should work now

## Troubleshooting

### "User not found in database" Error

This means the `lhUserId` is not set in Clerk's private metadata:
- Follow Step 2 above to set it

### Still Getting 500 Error

1. **Check API Logs:**
   - Look for the actual error message
   - Common issues:
     - Invalid JWT token
     - CORS configuration
     - Database connection

2. **Verify Environment Variables:**

   **API (.dev.vars):**
   ```
   DATABASE_URL=your_db_url
   CLERK_JWT_KEY=your_clerk_jwt_key
   CLERK_PRIVATE_KEY=your_clerk_secret_key
   WEBHOOK_SECRET=your_webhook_secret
   ALLOWED_ORIGIN=http://localhost:3000
   ALLOWED_PARTIES=your-clerk-frontend-api
   ```

   **Client (.env.local):**
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_API_URL=http://localhost:8080/api
   ```

3. **Test with Browser DevTools:**
   - Open Network tab
   - Try creating an appointment
   - Check the request headers (should have Authorization header)
   - Check the response for detailed error message

### JSON Parse Error

If you see "The string did not match the expected pattern":
- This means the authorization header format is wrong
- The client now correctly formats it as: `Bearer {"jwt":"token"}`
- Make sure you're using the latest version of the client code

## Production Deployment

For production:

1. **Update Webhook URL:**
   - Use your production API URL
   - Ensure it's accessible from Clerk's servers

2. **Update Environment Variables:**
   - Set production values for all env vars
   - Update `ALLOWED_ORIGIN` to your production domain

3. **Database Migration:**
   - Ensure all users have corresponding entries in the `users` table
   - Bulk update Clerk metadata with `lhUserId` values

## Need Help?

If you're still having issues:
1. Check the API server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure the Clerk webhook is receiving and processing events
4. Test with a fresh user account
