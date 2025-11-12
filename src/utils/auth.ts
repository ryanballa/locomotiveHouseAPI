import { verifyToken } from '@clerk/backend';
import { env } from 'hono/adapter';
import { dbInitalizer } from './db';
import { users, permissions, usersToClubs } from '../db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Middleware to authenticate requests using Clerk JWT tokens.
 *
 * Validates the authorization header and verifies the JWT token against Clerk's private key.
 * Supports both direct JWT tokens and legacy JSON payload format.
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
 * - Authorization header is missing
 * - Bearer token is missing or malformed
 * - JWT verification fails
 */
export const checkAuth = async function (c: any, next: any) {
	const { CLERK_PRIVATE_KEY } = env<{
		CLERK_PRIVATE_KEY: string;
	}>(c, 'workerd');

	const authHeader = c.req.raw.headers.get('authorization');

	if (!authHeader) {
		return c.json({ error: 'Unauthenticated' }, 403);
	}

	const temp = authHeader.split('Bearer ');
	if (!temp[1]) {
		return c.json({ error: 'Unauthenticated' }, 403);
	}

	try {
		let token: string | undefined;
		const bearerValue = temp[1];

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

		const verification = await verifyToken(token, {
			secretKey: CLERK_PRIVATE_KEY,
		});

		c.set('userId', verification.sub);
		return next();
	} catch (error) {
		console.error('Auth error:', error.message || error);
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
 * 1. The authenticated user exists in the database
 * 2. If user is not an admin, they must belong to the club specified in the `clubId` route parameter
 *
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
	const db = dbInitalizer({ c });
	const clerkUserId = c.var.userId;

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
		return c.json(
			{ error: 'User not found in database' },
			403
		);
	}

	const user = userResult[0];
	const userPermission = user.permission?.title;
	const isAdmin = hasAdminPermission(userPermission);

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
			return c.json(
				{ error: 'User does not belong to this club' },
				403
			);
		}
	}

	return next();
};
