# Locomotive House Client

A Next.js application for managing appointments with Clerk authentication.

## Features

- **Public Appointments View**: Anyone can view scheduled appointments without signing in
- **Authenticated Appointment Creation**: Signed-in users can create appointments in 30-minute intervals
- **Clerk Authentication**: Secure user authentication and management
- **Responsive Design**: Built with Tailwind CSS for a modern, mobile-friendly interface

## Prerequisites

- Node.js 18.x or later
- A Clerk account (sign up at https://clerk.com)
- Access to the Locomotive House API (running on `http://localhost:8080` by default)

## Setup Instructions

### 1. Install Dependencies

```bash
cd client
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the client directory:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Clerk credentials:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

### 3. Set Up Clerk

1. Go to https://clerk.com and create an account
2. Create a new application
3. Copy your publishable key and secret key to `.env.local`
4. In Clerk dashboard, configure:
   - **Sign-in methods**: Enable email/password or social providers
   - **JWT Template**: Create a default JWT template (used for API authentication)

### 4. Configure CORS in API

Ensure your API's `wrangler.toml` or `.dev.vars` includes:

```
ALLOWED_ORIGIN=http://localhost:3000
ALLOWED_PARTIES=your-clerk-frontend-api-url
```

The `ALLOWED_PARTIES` value can be found in your Clerk dashboard under "API Keys" > "Frontend API".

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
client/
├── app/
│   ├── appointments/
│   │   └── create/
│   │       └── page.tsx          # Create appointment page (protected)
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout with Clerk provider
│   └── page.tsx                  # Home page (appointments list)
├── components/
│   └── navbar.tsx                # Navigation bar with auth buttons
├── lib/
│   └── api.ts                    # API client for backend communication
├── middleware.ts                 # Clerk middleware for route protection
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

## Usage

### Viewing Appointments

1. Navigate to the home page (`/`)
2. All appointments are visible to everyone, even without signing in

### Creating Appointments

1. Click "Sign In" in the navbar
2. Sign in or create an account through Clerk
3. Click "Create Appointment" in the navbar
4. Select a date and time (30-minute intervals from 8:00 AM to 5:30 PM)
5. Submit the form

## API Integration

The client communicates with the backend API using the `apiClient` utility in `lib/api.ts`.

### Authentication

All authenticated requests include a Bearer token in the format:

```
Authorization: Bearer {"jwt": "clerk-jwt-token"}
```

This matches the format expected by your Cloudflare Workers API.

### Endpoints Used

- `GET /api/appointments/` - Fetch all appointments
- `POST /api/appointments/` - Create a new appointment (authenticated)
- `GET /api/users/` - Fetch users (authenticated)

## Important Notes

### Automatic User Registration

The app automatically handles user registration! When a user signs in for the first time:

1. The frontend checks if the user has an `lhUserId` in Clerk metadata
2. If not, it calls `/api/users/register` to create the user in your database
3. The API stores the Clerk user ID as the `token` field in the `users` table
4. The API updates Clerk metadata with the new `lhUserId`
5. Future requests use this cached `lhUserId` for appointments and other operations

No manual setup required - users are ready to create appointments immediately after signing in!

### Optional: Webhook Setup

For production environments, you may want to set up webhooks for better reliability:

1. In Clerk dashboard, go to "Webhooks"
2. Add endpoint: `https://your-api-domain.com/api/webhooks/`
3. Subscribe to events: `user.created`, `user.deleted`
4. Copy the webhook secret to your API's `.dev.vars` as `WEBHOOK_SECRET`

Webhooks will create users in the background when they sign up, but the auto-registration flow works as a fallback.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Customization

- **Time Slots**: Edit the `generateTimeSlots()` function in `app/appointments/create/page.tsx`
- **Styling**: Modify Tailwind classes or extend `tailwind.config.ts`
- **API URL**: Change `NEXT_PUBLIC_API_URL` in `.env.local`

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console:

1. Ensure `ALLOWED_ORIGIN` is set to `http://localhost:3000` in your API configuration
2. Restart the API server after changing environment variables

### Authentication Errors

If authentication fails:

1. Verify Clerk keys in `.env.local`
2. Check that `ALLOWED_PARTIES` in API matches your Clerk Frontend API URL
3. Ensure JWT template is configured in Clerk dashboard

### API Connection Issues

1. Verify the API is running on `http://localhost:8080`
2. Check `NEXT_PUBLIC_API_URL` in `.env.local`
3. Review browser network tab for detailed error messages

## License

ISC
