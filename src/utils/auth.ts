import { verifyToken, createClerkClient } from '@clerk/backend';
import { env } from 'hono/adapter';
import { dbInitalizer } from './db';
import { users, permissions, usersToClubs } from '../db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Middleware to authenticate requests using Clerk JWT tokens or M2M tokens.
 *
 * Validates the authorization header and verifies the JWT token against Clerk's private key.
 * Supports both direct JWT tokens, legacy JSON payload format, and M2M tokens via X-API-Key header.
 * Sets the authenticated user's ID in the Hono context for use in downstream middleware/handlers.
 *
 * @param c - Hono context containing request and environment variables
 * @param next - Hono next function to proceed to the next middleware/handler
 * @returns JSON error response with 403 status if authentication fails, otherwise calls next()
 *
 * @example
 * ```typescript
 * app.use(checkAuth);
 * app.get('/api/protected', (c) => {
 *   const userId = c.var.userId; // Set by checkAuth
 *   return c.json({ userId });
 * });
 * ```
 *
 * @throws Returns 403 error if:
 * - Authorization header is missing (and X-API-Key is not provided)
 * - Bearer token is missing or malformed
 * - JWT verification fails
 * - M2M token verification fails
 */
export const checkAuth = async function (c: any, next: any) {
	console.log('checkAuth called for:', c.req.method, c.req.url);
	const { CLERK_PRIVATE_KEY, CLERK_MACHINE_SECRET_KEY } = env<{
		CLERK_PRIVATE_KEY: string;
		CLERK_MACHINE_SECRET_KEY?: string;
	}>(c, 'workerd');

	// Debug: Log if CLERK_PRIVATE_KEY is undefined
	if (!CLERK_PRIVATE_KEY) {
		console.error('CLERK_PRIVATE_KEY is undefined!');
		return c.json({ error: 'Server authentication not configured' }, 500);
	}

	// Standard JWT authentication
	const authHeader = c.req.header('authorization');

	if (!authHeader) {
		console.log('No authorization header - returning 403');
		return c.json({ error: 'Unauthenticated' }, 403);
	}

	// Check for M2M token in X-API-Key header
	const apiKeyHeader = c.req.raw.headers.get('x-api-key');

	if (apiKeyHeader && authHeader) {
		if (!CLERK_MACHINE_SECRET_KEY) {
			return c.json({ error: 'M2M authentication not configured' }, 403);
		}

		try {
			const match = authHeader?.match(/^Bearer\s+(.+)$/i);
			const token = match?.[1];
			if (!token) {
				console.log('No Bearer token found - returning 403');
				return c.json({ error: 'Unauthenticated' }, 403);
			}
			const bearerValue = token;
			const clerkClient = createClerkClient({
				secretKey: CLERK_PRIVATE_KEY,
			});

			const m2mToken = await clerkClient.m2m.verify({
				token: bearerValue,
				machineSecretKey: CLERK_MACHINE_SECRET_KEY,
			});

			if (m2mToken.expired || m2mToken.revoked) {
				return c.json({ error: 'Invalid or expired M2M token' }, 403);
			}

			// Set M2M context
			c.set('isM2M', true);
			c.set('m2mSubject', m2mToken.subject);
			c.set('userId', 0); // M2M requests don't have a user ID
			return next();
		} catch (error) {
			console.error('M2M auth error:', error.message || error);
			return c.json({ error: 'Invalid M2M token' }, 403);
		}
	}

	try {
		let token: string | undefined;
		const match = authHeader?.match(/^Bearer\s+(.+)$/i);
		const tokenMatch = match?.[1];

		if (!tokenMatch) {
			console.log('No Bearer token found - returning 403');
			return c.json({ error: 'Unauthenticated' }, 403);
		}
		const bearerValue = tokenMatch;

		// Try to parse as JSON first (legacy format: Bearer {"jwt":"token"})
		try {
			const payload = JSON.parse(bearerValue);
			token = payload.jwt;
		} catch {
			// If not JSON, treat as direct JWT token (Bearer token)
			token = bearerValue;
		}

		if (!token) {
			return c.json({ error: 'Unauthenticated' }, 403);
		}

		console.log('[checkAuth] Attempting to verify token. Token length:', token?.length, 'Has CLERK_PRIVATE_KEY:', !!CLERK_PRIVATE_KEY);

		const verification = await verifyToken(token, {
			secretKey: CLERK_PRIVATE_KEY,
		});

		c.set('userId', verification.sub);
		c.set('clerkUserId', verification.sub);
		return next();
	} catch (error) {
		console.error('Auth error details:', {
			message: error.message || error,
			stack: error.stack,
			name: error.name,
		});
		return c.json({ error: 'Unauthenticated' }, 403);
	}
};

/**
 * Checks if a permission title represents an admin role.
 *
 * @param permissionTitle - The permission title to check (can be null or undefined)
 * @returns `true` if the permission is 'admin' or 'super-admin', otherwise `false`
 *
 * @example
 * ```typescript
 * if (hasAdminPermission('admin')) {
 *   // User has admin access
 * }
 * ```
 */
const hasAdminPermission = (permissionTitle: string | null | undefined): boolean => {
	return permissionTitle === 'admin' || permissionTitle === 'super-admin';
};

/**
 * Middleware to check user permissions and club membership.
 *
 * Verifies that:
 * 1. The authenticated user exists in the database (unless M2M request)
 * 2. If user is not an admin, they must belong to the club specified in the `clubId` route parameter
 *
 * M2M requests (identified by `isM2M` flag) bypass all permission checks.
 * Admins (with 'admin' or 'super-admin' permission) bypass club membership checks.
 * Non-admin users are restricted to clubs they are explicitly assigned to via the users_to_clubs table.
 *
 * Must be used after `checkAuth` middleware since it depends on `c.var.userId`.
 *
 * @param c - Hono context containing request, environment, and user ID (set by checkAuth)
 * @param next - Hono next function to proceed to the next middleware/handler
 * @returns JSON error response with 403 status if permission checks fail, otherwise calls next()
 *
 * @example
 * ```typescript
 * app.use(checkAuth);
 * app.use(checkUserPermission);
 * app.get('/api/clubs/:clubId/towers', (c) => {
 *   // User is authenticated and either:
 *   // - Is an M2M request, OR
 *   // - Is an admin, OR
 *   // - Belongs to the specified club
 *   return c.json({ authorized: true });
 * });
 * ```
 *
 * @throws Returns 403 error if:
 * - User not found in database
 * - Non-admin user does not belong to the specified club (if `clubId` param exists)
 */
export const checkUserPermission = async function (c: any, next: any) {
	console.log('checkUserPermission called');
	const db = dbInitalizer({ c });
	const clerkUserId = c.var.userId;
	const isM2M = c.var.isM2M;
	console.log('clerkUserId:', clerkUserId, 'isM2M:', isM2M);

	// M2M requests bypass all permission checks
	if (isM2M) {
		console.log('M2M request - bypassing permission checks');
		return next();
	}

	// Find user in database by clerk ID with permissions
	const userResult = await db
		.select({
			id: users.id,
			permission: permissions,
		})
		.from(users)
		.leftJoin(permissions, eq(users.permission, permissions.id))
		.where(eq(users.token, clerkUserId));

	if (!userResult || userResult.length === 0) {
		console.error('User not found in database. Clerk ID:', clerkUserId);
		return c.json({ error: 'User not found in database' }, 403);
	}

	const user = userResult[0];
	const userPermission = user.permission?.title;
	const isAdmin = hasAdminPermission(userPermission);

	// Update userId to the database user ID (integer) for use in routes
	// This overwrites the Clerk ID (string) set by checkAuth
	c.set('userId', user.id);

	// If admin or super-admin, allow access
	if (isAdmin) {
		return next();
	}

	// Check if clubId is specified in route params
	const clubId = c.req.param('clubId');
	if (clubId) {
		// Verify user belongs to the club
		const clubMembership = await db
			.select()
			.from(usersToClubs)
			.where(and(eq(usersToClubs.user_id, user.id), eq(usersToClubs.club_id, parseInt(clubId, 10))));

		if (!clubMembership || clubMembership.length === 0) {
			console.error(`User ${user.id} does not belong to club ${clubId}. Club memberships:`, clubMembership);
			return c.json({ error: `User does not belong to club ${clubId}` }, 403);
		}
	}

	return next();
};
