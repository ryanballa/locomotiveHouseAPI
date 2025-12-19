// src/index.ts
import { Webhook } from 'svix';
import { addresses, consists, clubs, usersToClubs, users, permissions, appointments, inviteTokens } from './db/schema';
import { dbInitalizer } from './utils/db';
import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { env } from 'hono/adapter';
import { logger } from 'hono/logger';
import { verifyToken, createClerkClient } from '@clerk/backend';
import * as addressesModel from './addresses/model';
import * as consistsModel from './consists/model';
import * as usersModel from './users/model';
import * as clubsModel from './clubs/model';
import * as appointmentsModel from './appointments/model';
import * as inviteTokensModel from './inviteTokens/model';
import { emailQueueModel } from './emailQueue/model';
import { towersRouter } from './towers/routes';
import { issuesRouter } from './issues/routes';
import { towerReportsRouter } from './towerReports/routes';
import { scheduledSessionsRouter } from './scheduledSessions/routes';
import { noticesRouter } from './notices/routes';
import { applicationsRouter } from './applications/routes';
import { usersRouter, clubUsersRouter } from './users/routes';
import * as towerReportsModel from './towerReports/model';
import { cors } from 'hono/cors';
import { eq, and } from 'drizzle-orm';
import { refreshAccessToken, extractRefreshToken } from './utils/tokenRefresh';

export type Env = {
	DATABASE_URL: string;
	WEBHOOK_SECRET: string;
	CLERK_PRIVATE_KEY: string;
	API_KEY: string;
	ALLOWED_ORIGIN: string;
	SERVICE_ACCOUNT_USER_IDS?: string; // Comma-separated list of Clerk user IDs for service accounts
};

//TODO break this file up

const checkAuth = async function (c, next) {
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
		console.error('Full error:', error);
		return c.json({ error: 'Unauthenticated' }, 403);
	}
};

const checkUserPermission = async function (c, next) {
	const db = dbInitalizer({ c });
	const clerkUserId = c.var.userId;
	const { SERVICE_ACCOUNT_USER_IDS } = env<{ SERVICE_ACCOUNT_USER_IDS?: string }>(c, 'workerd');

	// Check if this is a service account (bypasses database lookup)
	if (SERVICE_ACCOUNT_USER_IDS) {
		const serviceAccountIds = SERVICE_ACCOUNT_USER_IDS.split(',').map((id) => id.trim());
		if (serviceAccountIds.includes(clerkUserId)) {
			// Store the Clerk ID for service accounts
			c.set('clerkUserId', clerkUserId);
			// Service accounts don't have a database user ID, use 0 or null
			c.set('userId', 0);
			c.set('isServiceAccount', true);
			return next();
		}
	}

	// Find user in database by clerk ID
	const userResult = await getUserIdFromClerkId(db, clerkUserId);

	if (!userResult) {
		return c.json({ error: 'User not found in database' }, 403);
	}

	// Store the Clerk ID separately before overwriting userId
	c.set('clerkUserId', clerkUserId);
	// Update userId to the database user ID (integer) for use in routes
	// Explicitly convert to number to ensure it's not a string
	c.set('userId', Number(userResult.id));

	return next();
};

const checkAdminPermission = async function (c, next) {
	const db = dbInitalizer({ c });
	const clerkUserId = c.var.userId;
	const { SERVICE_ACCOUNT_USER_IDS } = env<{ SERVICE_ACCOUNT_USER_IDS?: string }>(c, 'workerd');

	// Service accounts have admin-level access
	if (SERVICE_ACCOUNT_USER_IDS) {
		const serviceAccountIds = SERVICE_ACCOUNT_USER_IDS.split(',').map((id) => id.trim());
		if (serviceAccountIds.includes(clerkUserId)) {
			return next();
		}
	}

	try {
		// Find user in database by clerk ID
		const userIdResult = await getUserIdFromClerkId(db, clerkUserId);

		if (!userIdResult) {
			return c.json(
				{
					error: 'User not found',
				},
				403
			);
		}

		// Get user with their permission
		const userResult = await db
			.select({
				user: users,
				permission: permissions,
			})
			.from(users)
			.leftJoin(permissions, eq(users.permission, permissions.id))
			.where(eq(users.id, userIdResult.id));

		if (userResult.length === 0) {
			return c.json(
				{
					error: 'User not found',
				},
				403
			);
		}

		const userPermission = userResult[0].permission;

		if (hasAdminPermission(userPermission?.title)) {
			return next();
		}

		return c.json(
			{
				error: 'Admin permission required',
			},
			403
		);
	} catch (error) {
		console.error('Admin permission check error:', error);
		return c.json(
			{
				error: 'Permission check failed',
			},
			500
		);
	}
};

const hasAdminPermission = (permissionTitle: string | null | undefined): boolean => {
	return permissionTitle === 'admin' || permissionTitle === 'super-admin';
};

/**
 * API Key verification middleware
 * Ensures requests include a valid API key in the X-API-Key header
 * This provides an additional layer of security beyond JWT authentication
 */
const checkApiKey = async function (c, next) {
	const apiKey = c.req.header('X-API-Key');
	const { API_KEY } = env<{ API_KEY: string }>(c, 'workerd');

	if (!apiKey) {
		return c.json({ error: 'Missing API key' }, 401);
	}

	if (apiKey !== API_KEY) {
		return c.json({ error: 'Invalid API key' }, 401);
	}

	return next();
};

/**
 * Email Queue Auth Middleware
 * Supports both JWT tokens and refresh tokens for external services
 * If refresh token is provided, it will be used to get a new JWT
 */
const checkEmailQueueAuth = async function (c, next) {
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

		// Try to parse as JSON first (legacy format)
		try {
			const payload = JSON.parse(bearerValue);
			token = payload.jwt;
		} catch {
			// If not JSON, treat as direct token (JWT or refresh token)
			token = bearerValue;
		}

		if (!token) {
			return c.json({ error: 'Unauthenticated' }, 403);
		}

		// Check if this looks like a refresh token
		if (token.startsWith('refresh_')) {
			// Attempt to refresh the token
			try {
				const refreshResult = await refreshAccessToken(token, CLERK_PRIVATE_KEY);
				token = refreshResult.accessToken;
				// Store refreshed token for use in endpoint
				c.set('refreshedToken', token);
				c.set('newRefreshToken', refreshResult.refreshToken);
			} catch (refreshError) {
				return c.json({ error: 'Failed to refresh token' }, 401);
			}
		}

		// Verify the JWT token (either original or refreshed)
		const { verifyToken } = await import('@clerk/backend');
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

const checkClubAccess = async function (c, next) {
	const db = dbInitalizer({ c });
	const clerkUserId = c.var.userId;
	const clubId = c.req.param('id');
	const { SERVICE_ACCOUNT_USER_IDS } = env<{ SERVICE_ACCOUNT_USER_IDS?: string }>(c, 'workerd');

	// Service accounts have access to all clubs
	if (SERVICE_ACCOUNT_USER_IDS) {
		const serviceAccountIds = SERVICE_ACCOUNT_USER_IDS.split(',').map((id) => id.trim());
		if (serviceAccountIds.includes(clerkUserId)) {
			return next();
		}
	}

	try {
		// Find user in database by clerk ID
		const userIdResult = await getUserIdFromClerkId(db, clerkUserId);

		if (!userIdResult) {
			return c.json(
				{
					error: 'User not found',
				},
				403
			);
		}

		// Get user permission to check if admin
		const userResult = await db
			.select({
				user: users,
				permission: permissions,
			})
			.from(users)
			.leftJoin(permissions, eq(users.permission, permissions.id))
			.where(eq(users.id, userIdResult.id));

		if (userResult.length === 0) {
			return c.json(
				{
					error: 'User not found',
				},
				403
			);
		}

		const userPermission = userResult[0].permission;
		const isAdmin = hasAdminPermission(userPermission?.title);

		// Admins have access to all clubs
		if (isAdmin) {
			return next();
		}

		// Non-admins must be assigned to the club
		const clubAssignment = await db
			.select()
			.from(usersToClubs)
			.where(and(eq(usersToClubs.user_id, userIdResult.id), eq(usersToClubs.club_id, parseInt(clubId, 10))));

		if (clubAssignment.length === 0) {
			return c.json(
				{
					error: 'Unauthorized: You do not have access to this club',
				},
				403
			);
		}

		return next();
	} catch (error) {
		console.error('Club access check error:', error);
		return c.json(
			{
				error: 'Permission check failed',
			},
			500
		);
	}
};

// Utility function to get the database user ID from clerk ID
const getUserIdFromClerkId = async (db: ReturnType<typeof dbInitalizer>, clerkUserId: string): Promise<{ id: number } | null> => {
	const result = await db.select({ id: users.id }).from(users).where(eq(users.token, clerkUserId));

	return result.length > 0 ? result[0] : null;
};

const app = new Hono<{ Bindings: Env }>();
app.use('/etag/*', etag());
app.use(logger());

app.onError((err, c) => {
	console.error('Unhandled error:', err);
	return c.json({ error: 'Internal Server Error' }, 500);
});

app.use(
	'/api/*',
	cors({
		origin: (origin, c) => {
			const { ALLOWED_ORIGIN } = env<{ ALLOWED_ORIGIN: string }>(c, 'workerd');
			// Support comma-separated list of allowed origins
			const allowedOrigins = ALLOWED_ORIGIN.split(',').map((o) => o.trim());

			// Only allow requests from the configured origins
			// Reject all other origins, including requests without an origin
			if (origin && allowedOrigins.includes(origin)) {
				return origin;
			}
			return false;
		},
		credentials: true,
	})
);

// Mount users routes
app.route('/api/users', usersRouter);
app.route('/api/clubs/:clubId/users', clubUsersRouter);

// Mount more specific routes FIRST (before general tower routes)
// This ensures /reports and /issues routes are matched before the generic /towers route

// Mount tower reports routes (more specific)
app.route('/api/clubs/:clubId/towers/:towerId/reports', towerReportsRouter);

// Mount issues routes (more specific)
app.route('/api/clubs/:clubId/towers/:towerId/issues', issuesRouter);

// Mount scheduled sessions routes
app.route('/api/clubs/:clubId/scheduled-sessions', scheduledSessionsRouter);

// Mount notices routes
app.route('/api/clubs/:clubId/notices', noticesRouter);

// Mount applications routes
app.route('/api/clubs/:clubId/applications', applicationsRouter);

// Mount towers routes (general - must be last)
app.route('/api/clubs/:clubId/towers', towersRouter);

/**
 * GET all tower reports for a club
 * Route: GET /api/clubs/:clubId/reports
 *
 * Retrieves all reports from all towers within a specific club.
 * This provides a club-level aggregation of all tower reports.
 * Supports optional filtering by year and/or month.
 *
 * Query Parameters:
 * - year (optional): Filter reports by year (e.g., 2024)
 * - month (optional): Filter reports by month (1-12). Only applies if year is also provided.
 *
 * @example
 * GET /api/clubs/789/reports - Get all reports for club 789
 * GET /api/clubs/789/reports?year=2024 - Get reports from 2024
 * GET /api/clubs/789/reports?year=2024&month=11 - Get reports from November 2024
 */
app.get('/api/clubs/:clubId/reports', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const clubId = c.req.param('clubId');

		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID in route',
				},
				400
			);
		}

		// Parse optional query parameters
		const yearParam = c.req.query('year');
		const monthParam = c.req.query('month');

		const filters: { year?: number; month?: number } = {};

		if (yearParam) {
			const year = parseInt(yearParam, 10);
			if (!isNaN(year)) {
				filters.year = year;
			}
		}

		if (monthParam) {
			const month = parseInt(monthParam, 10);
			if (!isNaN(month)) {
				filters.month = month;
			}
		}

		const result = await towerReportsModel.getTowerReportsByClubIdWithDateFilter(
			db,
			parseInt(clubId, 10),
			Object.keys(filters).length > 0 ? filters : undefined
		);
		if (result.error) {
			return c.json(
				{
					error: result.error,
				},
				400
			);
		}
		return c.json({
			result: result.data,
		});
	} catch (error) {
		return c.json(
			{
				error: error instanceof Error ? error.message : String(error),
			},
			400
		);
	}
});

app.get('/api/addresses/', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const result = await db.select().from(addresses);
		return c.json({
			result,
		});
	} catch (error) {
		return c.json(
			{
				error,
			},
			400
		);
	}
});

app.post('/api/addresses/', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const data = await c.req.json();
	const clerkUserId = c.var.clerkUserId;

	// Validate required fields
	if (!data.club_id) {
		return c.json(
			{
				error: 'Missing required field: club_id',
			},
			400
		);
	}

	// Find user in database by clerk ID
	const userIdResult = await getUserIdFromClerkId(db, clerkUserId);

	if (!userIdResult) {
		return c.json({ error: 'User not found in database' }, 403);
	}

	const lhUserId = userIdResult.id;

	// Check user's permission level
	try {
		const userResult = await db
			.select({
				user: users,
				permission: permissions,
			})
			.from(users)
			.leftJoin(permissions, eq(users.permission, permissions.id))
			.where(eq(users.id, lhUserId));

		if (userResult.length === 0) {
			return c.json(
				{
					error: 'User not found',
				},
				403
			);
		}

		const userPermission = userResult[0].permission;
		const isAdmin = hasAdminPermission(userPermission?.title);

		// If not admin, verify that request.user_id === authenticated_user_id
		if (!isAdmin && data.user_id !== lhUserId) {
			return c.json(
				{
					error: 'Unauthorized: You can only create addresses for yourself',
				},
				403
			);
		}

		// Verify user is assigned to the club (unless admin)
		if (!isAdmin) {
			const userClubAssignment = await db
				.select()
				.from(usersToClubs)
				.where(and(eq(usersToClubs.user_id, lhUserId), eq(usersToClubs.club_id, data.club_id)));

			if (userClubAssignment.length === 0) {
				return c.json(
					{
						error: 'Unauthorized: You are not assigned to this club',
					},
					403
				);
			}
		}

		const newAddresses = await addressesModel.createAddress(db, data as addressesModel.Address);
		if (newAddresses.error) {
			return c.json(
				{
					error: newAddresses.error,
				},
				400
			);
		}
		return c.json(
			{
				address: newAddresses,
			},
			201
		);
	} catch (error) {
		console.error('Error creating address:', error);
		return c.json(
			{
				error: 'Failed to create address',
			},
			500
		);
	}
});

app.put('/api/addresses/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const data = await c.req.json();
		const clerkUserId = c.var.clerkUserId;

		// Validate required fields
		if (!data.club_id) {
			return c.json(
				{
					error: 'Missing required field: club_id',
				},
				400
			);
		}

		// Find user in database by clerk ID
		const userIdResult = await getUserIdFromClerkId(db, clerkUserId);

		if (!userIdResult) {
			return c.json({ error: 'User not found in database' }, 403);
		}

		const lhUserId = userIdResult.id;

		// Get the existing address record
		const existingAddresses = await db
			.select()
			.from(addresses)
			.where(eq(addresses.id, parseInt(id, 10)));

		if (existingAddresses.length === 0) {
			return c.json(
				{
					error: 'Address not found',
				},
				404
			);
		}

		// Check user's permission level
		const userResult = await db
			.select({
				user: users,
				permission: permissions,
			})
			.from(users)
			.leftJoin(permissions, eq(users.permission, permissions.id))
			.where(eq(users.id, lhUserId));

		if (userResult.length === 0) {
			return c.json(
				{
					error: 'User not found',
				},
				403
			);
		}

		const userPermission = userResult[0].permission;
		const isAdmin = hasAdminPermission(userPermission?.title);

		// If not admin, verify that address.user_id === authenticated_user_id
		if (!isAdmin && existingAddresses[0].user_id !== lhUserId) {
			return c.json(
				{
					error: 'Unauthorized: You can only edit your own addresses',
				},
				403
			);
		}

		// Verify user is assigned to the club (unless admin)
		if (!isAdmin) {
			const userClubAssignment = await db
				.select()
				.from(usersToClubs)
				.where(and(eq(usersToClubs.user_id, lhUserId), eq(usersToClubs.club_id, data.club_id)));

			if (userClubAssignment.length === 0) {
				return c.json(
					{
						error: 'Unauthorized: You are not assigned to this club',
					},
					403
				);
			}
		}

		const updatedAddress = await addressesModel.updateAddress(db, id, data as addressesModel.Address);
		if (updatedAddress.error) {
			return c.json(
				{
					error: updatedAddress.error,
				},
				400
			);
		}
		return c.json(
			{
				address: updatedAddress.data,
			},
			201
		);
	} catch (err) {
		console.error('Error updating address:', err);
		return c.json(
			{
				error: 'Failed to update address',
			},
			500
		);
	}
});

app.delete('/api/addresses/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const clerkUserId = c.var.clerkUserId;

	// Find user in database by clerk ID
	const userIdResult = await getUserIdFromClerkId(db, clerkUserId);

	if (!userIdResult) {
		return c.json({ error: 'User not found in database' }, 403);
	}

	const lhUserId = userIdResult.id;

	// Get the existing address record
	const existingAddresses = await db
		.select()
		.from(addresses)
		.where(eq(addresses.id, parseInt(id, 10)));

	if (existingAddresses.length === 0) {
		return c.json(
			{
				error: 'Address not found',
			},
			404
		);
	}

	try {
		// Check user's permission level
		const userResult = await db
			.select({
				user: users,
				permission: permissions,
			})
			.from(users)
			.leftJoin(permissions, eq(users.permission, permissions.id))
			.where(eq(users.id, lhUserId));

		if (userResult.length === 0) {
			return c.json(
				{
					error: 'User not found',
				},
				403
			);
		}

		const userPermission = userResult[0].permission;
		const isAdmin = hasAdminPermission(userPermission?.title);

		// If not admin, verify that address.user_id === authenticated_user_id
		if (!isAdmin && existingAddresses[0].user_id !== lhUserId) {
			return c.json(
				{
					error: 'Unauthorized: You can only delete your own addresses',
				},
				403
			);
		}

		const deletedAddress = await addressesModel.deleteAddress(db, id);
		if (deletedAddress.error) {
			return c.json(
				{
					error: deletedAddress.error,
				},
				400
			);
		}
		return c.json(
			{
				address: deletedAddress,
			},
			200
		);
	} catch (error) {
		console.error('Error deleting address:', error);
		return c.json(
			{
				error: 'Failed to delete address',
			},
			500
		);
	}
});

app.get('/api/clubs/', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const result = await db.select().from(clubs);
		return c.json({
			result,
		});
	} catch (error) {
		return c.json(
			{
				error,
			},
			400
		);
	}
});

app.post('/api/clubs/', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	const data = await c.req.json();
	const newClub = await clubsModel.createClub(db, data as clubsModel.Club);
	if (newClub.error) {
		return c.json(
			{
				error: newClub.error,
			},
			400
		);
	}
	return c.json(
		{
			club: newClub,
		},
		201
	);
});

app.put('/api/clubs/:id', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const data = await c.req.json();
		const updatedClub = await clubsModel.updateClub(db, id, data as clubsModel.Club);
		if (updatedClub.error) {
			return c.json(
				{
					error: updatedClub.error,
				},
				400
			);
		}
		return c.json(
			{
				club: updatedClub.data,
			},
			201
		);
	} catch (err) {
		console.error('Error updating club:', err);
		return c.json(
			{
				error: 'Failed to update club',
			},
			500
		);
	}
});

app.get('/api/clubs/invite/validate', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const token = c.req.query('token');

	try {
		if (!token) {
			return c.json(
				{
					error: 'Missing invite token',
				},
				400
			);
		}

		// Validate invite token
		const tokenValidation = await inviteTokensModel.validateInviteToken(db, token);

		if (tokenValidation.error) {
			return c.json(
				{
					error: tokenValidation.error,
				},
				400
			);
		}

		// Get club details
		const clubResult = await db.select().from(clubs).where(eq(clubs.id, tokenValidation.data!.club_id));

		if (clubResult.length === 0) {
			return c.json(
				{
					error: 'Club not found',
				},
				404
			);
		}

		// Get role information if role_permission is set
		let roleInfo = null;
		if (tokenValidation.data?.role_permission) {
			const permissionResult = await db.select().from(permissions).where(eq(permissions.id, tokenValidation.data.role_permission));

			if (permissionResult.length > 0) {
				roleInfo = permissionResult[0];
			}
		}

		return c.json(
			{
				valid: true,
				token: tokenValidation.data,
				club: clubResult[0],
				role: roleInfo,
			},
			200
		);
	} catch (error) {
		console.error('Error validating invite token:', error);
		return c.json(
			{
				error: 'Failed to validate invite token',
			},
			500
		);
	}
});

app.get('/api/clubs/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubResult = await db
			.select()
			.from(clubs)
			.where(eq(clubs.id, parseInt(id, 10)));

		if (clubResult.length === 0) {
			return c.json(
				{
					error: 'Club not found',
				},
				404
			);
		}

		return c.json(
			{
				club: clubResult[0],
			},
			200
		);
	} catch (err) {
		console.error('Error fetching club:', err);
		return c.json(
			{
				error: 'Failed to fetch club',
			},
			500
		);
	}
});

app.get('/api/clubs/:id/appointments', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const clubId = c.req.param('id');

		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID',
				},
				400
			);
		}

		// Verify club exists
		const clubResult = await db
			.select()
			.from(clubs)
			.where(eq(clubs.id, parseInt(clubId, 10)));
		if (clubResult.length === 0) {
			return c.json(
				{
					error: 'Club not found',
				},
				404
			);
		}

		const appointmentsResult = await appointmentsModel.getAppointmentsByClubId(db, clubId);

		if (appointmentsResult.error) {
			return c.json(
				{
					error: appointmentsResult.error,
				},
				500
			);
		}

		return c.json(
			{
				appointments: appointmentsResult.data || [],
			},
			200
		);
	} catch (err) {
		console.error('Error fetching club appointments:', err);
		return c.json(
			{
				error: 'Failed to fetch appointments',
			},
			500
		);
	}
});

app.get('/api/clubs/:id/addresses', checkAuth, checkClubAccess, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const clubId = c.req.param('id');

		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID',
				},
				400
			);
		}

		// Verify club exists
		const clubResult = await db
			.select()
			.from(clubs)
			.where(eq(clubs.id, parseInt(clubId, 10)));
		if (clubResult.length === 0) {
			return c.json(
				{
					error: 'Club not found',
				},
				404
			);
		}

		const addressesResult = await addressesModel.getAddressesByClubId(db, clubId);

		if (addressesResult.error) {
			return c.json(
				{
					error: addressesResult.error,
				},
				500
			);
		}

		return c.json(
			{
				addresses: addressesResult.data || [],
			},
			200
		);
	} catch (err) {
		console.error('Error fetching club addresses:', err);
		return c.json(
			{
				error: 'Failed to fetch addresses',
			},
			500
		);
	}
});

app.post('/api/clubs/assignments/', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	const data = await c.req.json();
	const newClubAssignments = await clubsModel.createClubAssignments(db, data as clubsModel.AssignmentResult);
	if (newClubAssignments.error) {
		return c.json(
			{
				error: newClubAssignments.error,
			},
			400
		);
	}
	return c.json(
		{
			clubAssignments: newClubAssignments,
		},
		201
	);
});

app.get('/api/clubs/assignments/', async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.query('id');
	try {
		const result = await db
			.select()
			.from(usersToClubs)
			.where(id ? eq(usersToClubs.club_id, parseInt(id, 10)) : undefined);
		const usersResults = await db.select().from(users);

		const augmentAssignments = result.map((assignment) => {
			const user = usersResults.find((user) => user.id === assignment.user_id);
			return { ...assignment, token: user?.token };
		});
		return c.json({
			result: augmentAssignments,
		});
	} catch (error) {
		return c.json(
			{
				error,
			},
			400
		);
	}
});

app.post('/api/clubs/:id/invite-tokens', checkAuth, checkAdminPermission, async (c) => {
	const db = dbInitalizer({ c });
	const clubId = c.req.param('id');

	try {
		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID',
				},
				400
			);
		}

		// Get request body
		const data = await c.req.json();
		const expiresAt = data.expiresAt || data.expires_at;

		if (!expiresAt) {
			return c.json(
				{
					error: 'Missing expiration date',
				},
				400
			);
		}

		// Get optional role permission
		const rolePermission = data.rolePermission || data.role_permission;

		// Create invite token
		const result = await inviteTokensModel.createInviteToken(
			db,
			parseInt(clubId, 10),
			new Date(expiresAt),
			rolePermission ? parseInt(rolePermission, 10) : undefined
		);

		if (result.error) {
			return c.json(
				{
					error: result.error,
				},
				400
			);
		}

		return c.json(
			{
				token: result.data,
			},
			201
		);
	} catch (error) {
		console.error('Error creating invite token:', error);
		return c.json(
			{
				error: 'Failed to create invite token',
			},
			500
		);
	}
});

app.get('/api/clubs/:id/invite-tokens', checkAuth, checkAdminPermission, async (c) => {
	const db = dbInitalizer({ c });
	const clubId = c.req.param('id');

	try {
		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID',
				},
				400
			);
		}

		// Get invite tokens for club
		const result = await inviteTokensModel.getClubInviteTokens(db, parseInt(clubId, 10));

		if (result.error) {
			return c.json(
				{
					error: result.error,
				},
				400
			);
		}

		return c.json(
			{
				tokens: result.data,
			},
			200
		);
	} catch (error) {
		console.error('Error fetching invite tokens:', error);
		return c.json(
			{
				error: 'Failed to fetch invite tokens',
			},
			500
		);
	}
});

app.delete('/api/clubs/:id/invite-tokens/:token', checkAuth, checkAdminPermission, async (c) => {
	const db = dbInitalizer({ c });
	const token = c.req.param('token');

	try {
		if (!token) {
			return c.json(
				{
					error: 'Missing token',
				},
				400
			);
		}

		// Delete invite token
		const result = await inviteTokensModel.deleteInviteToken(db, token);

		if (result.error) {
			return c.json(
				{
					error: result.error,
				},
				400
			);
		}

		return c.json(
			{
				deleted: true,
				token,
			},
			200
		);
	} catch (error) {
		console.error('Error deleting invite token:', error);
		return c.json(
			{
				error: 'Failed to delete invite token',
			},
			500
		);
	}
});

app.get('/api/consists/', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const result = await db.select().from(consists);
		return c.json({
			result,
		});
	} catch (error) {
		return c.json(
			{
				error,
			},
			400
		);
	}
});

app.post('/api/consists/', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const data = await c.req.json();
	const newConsist = await consistsModel.createConsist(db, data as consistsModel.Consist);
	if (newConsist.error) {
		return c.json(
			{
				error: newConsist.error,
			},
			400
		);
	}
	return c.json(
		{
			consist: newConsist,
		},
		201
	);
});

app.delete('/api/consists/:id', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const deletedConsist = await consistsModel.deleteConsist(db, id);
	if (deletedConsist.error) {
		return c.json(
			{
				error: deletedConsist.error,
			},
			400
		);
	}
	return c.json(
		{
			address: deletedConsist,
		},
		200
	);
});

app.get('/api/appointments/', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const result = await db.select().from(appointments);
		return c.json({
			result,
		});
	} catch (error) {
		return c.json(
			{
				error,
			},
			400
		);
	}
});

app.post('/api/appointments/', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const formattedData = await c.req.json();

	const newAppointment = await appointmentsModel.createAppointment(db, formattedData as appointmentsModel.Appointment);

	if (newAppointment.error) {
		return c.json(
			{
				error: newAppointment.error,
			},
			400
		);
	}
	return c.json(
		{
			created: true,
			id: newAppointment.data[0].id,
		},
		200
	);
});

app.put('/api/appointments/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const data = await c.req.json();
	const clerkUserId = c.var.clerkUserId;

	// Find user in database by clerk ID
	const userIdResult = await getUserIdFromClerkId(db, clerkUserId);

	if (!userIdResult) {
		return c.json({ error: 'User not found in database' }, 403);
	}

	const lhUserId = userIdResult.id;

	// Check if the appointment exists and belongs to the user
	const existingAppointments = await db
		.select()
		.from(appointments)
		.where(eq(appointments.id, parseInt(id, 10)));
	if (existingAppointments.length === 0) {
		return c.json(
			{
				error: 'Appointment not found',
			},
			404
		);
	}

	if (existingAppointments[0].user_id !== lhUserId) {
		return c.json(
			{
				error: 'Unauthorized: You can only edit your own appointments',
			},
			403
		);
	}

	const updatedAppointment = await appointmentsModel.updateAppointment(db, id, data as appointmentsModel.Appointment);

	if (updatedAppointment.error) {
		console.error('Update appointment error:', updatedAppointment.error);
		return c.json(
			{
				error: typeof updatedAppointment.error === 'string' ? updatedAppointment.error : JSON.stringify(updatedAppointment.error),
			},
			400
		);
	}
	return c.json(
		{
			updated: true,
			appointment: updatedAppointment.data,
		},
		200
	);
});

app.delete('/api/appointments/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const clerkUserId = c.var.clerkUserId;

	// Find user in database by clerk ID
	const userIdResult = await getUserIdFromClerkId(db, clerkUserId);

	if (!userIdResult) {
		return c.json({ error: 'User not found in database' }, 403);
	}

	const lhUserId = userIdResult.id;

	// Check if the appointment exists and belongs to the user
	const existingAppointments = await db
		.select()
		.from(appointments)
		.where(eq(appointments.id, parseInt(id, 10)));
	if (existingAppointments.length === 0) {
		return c.json(
			{
				error: 'Appointment not found',
			},
			404
		);
	}

	// Check user permissions for admin override
	const userResult = await db
		.select({ permission: permissions })
		.from(users)
		.leftJoin(permissions, eq(users.permission, permissions.id))
		.where(eq(users.id, lhUserId));

	if (userResult.length === 0) {
		return c.json(
			{
				error: 'User not found',
			},
			403
		);
	}

	const userPermission = userResult[0].permission;
	const isAdmin = hasAdminPermission(userPermission?.title);

	// If not admin, verify that appointment.user_id === authenticated_user_id
	if (!isAdmin && existingAppointments[0].user_id !== lhUserId) {
		return c.json(
			{
				error: 'Unauthorized: You can only delete your own appointments',
			},
			403
		);
	}

	const deletedAppointment = await appointmentsModel.deleteAppointment(db, id);

	if (deletedAppointment.error) {
		return c.json(
			{
				error: deletedAppointment.error,
			},
			400
		);
	}
	return c.json(
		{
			deleted: true,
		},
		200
	);
});

// Email Queue Endpoints
app.post('/api/email-queue/', checkApiKey, checkEmailQueueAuth, async (c) => {
	const db = dbInitalizer({ c });

	try {
		const body = await c.req.json();

		// Validate required fields
		if (!body.recipient_email || !body.subject || !body.body) {
			return c.json({ error: 'Missing required fields: recipient_email, subject, body' }, 400);
		}

		const result = await emailQueueModel.createEmail(db, {
			recipient_email: body.recipient_email,
			subject: body.subject,
			body: body.body,
			html_body: body.html_body,
			max_retries: body.max_retries ?? 3,
			scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : undefined,
		});

		if (result.error) {
			return c.json({ error: result.error }, 400);
		}

		return c.json({ data: result.data }, 201);
	} catch (error) {
		return c.json({ error: `Failed to create email: ${error}` }, 500);
	}
});

app.get('/api/email-queue/', checkApiKey, checkEmailQueueAuth, async (c) => {
	const db = dbInitalizer({ c });

	try {
		const status = c.req.query('status') as 'pending' | 'sent' | 'failed' | undefined;
		const limit = parseInt(c.req.query('limit') || '50', 10);
		const offset = parseInt(c.req.query('offset') || '0', 10);
		const order = (c.req.query('order') || 'desc') as 'asc' | 'desc';

		const result = await emailQueueModel.listEmails(db, {
			status,
			limit,
			offset,
			order,
		});

		if (result.error) {
			return c.json({ error: result.error }, 400);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to list emails: ${error}` }, 500);
	}
});

app.get('/api/email-queue/:id', checkApiKey, checkEmailQueueAuth, async (c) => {
	const db = dbInitalizer({ c });
	const id = parseInt(c.req.param('id'), 10);

	if (isNaN(id)) {
		return c.json({ error: 'Invalid email ID' }, 400);
	}

	try {
		const result = await emailQueueModel.getEmail(db, id);

		if (result.error) {
			return c.json({ error: result.error }, 404);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to fetch email: ${error}` }, 500);
	}
});

app.put('/api/email-queue/:id', checkApiKey, checkEmailQueueAuth, async (c) => {
	const db = dbInitalizer({ c });
	const id = parseInt(c.req.param('id'), 10);

	if (isNaN(id)) {
		return c.json({ error: 'Invalid email ID' }, 400);
	}

	try {
		const body = await c.req.json();

		const result = await emailQueueModel.updateEmail(db, id, {
			status: body.status,
			retry_count: body.retry_count,
			last_error: body.last_error,
			sent_at: body.sent_at ? new Date(body.sent_at) : undefined,
		});

		if (result.error) {
			return c.json({ error: result.error }, 404);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to update email: ${error}` }, 500);
	}
});

app.delete('/api/email-queue/:id', checkApiKey, checkEmailQueueAuth, async (c) => {
	const db = dbInitalizer({ c });
	const id = parseInt(c.req.param('id'), 10);

	if (isNaN(id)) {
		return c.json({ error: 'Invalid email ID' }, 400);
	}

	try {
		const result = await emailQueueModel.deleteEmail(db, id);

		if (result.error) {
			return c.json({ error: result.error }, 404);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to delete email: ${error}` }, 500);
	}
});

app.get('/api/email-queue/pending/list', checkApiKey, checkEmailQueueAuth, async (c) => {
	const db = dbInitalizer({ c });

	try {
		const limit = parseInt(c.req.query('limit') || '10', 10);
		const result = await emailQueueModel.getPendingEmails(db, limit);

		if (result.error) {
			return c.json({ error: result.error }, 400);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to fetch pending emails: ${error}` }, 500);
	}
});

app.get('/api/email-queue/failed/list', checkApiKey, checkEmailQueueAuth, async (c) => {
	const db = dbInitalizer({ c });

	try {
		const limit = parseInt(c.req.query('limit') || '10', 10);
		const result = await emailQueueModel.getFailedEmails(db, limit);

		if (result.error) {
			return c.json({ error: result.error }, 400);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to fetch failed emails: ${error}` }, 500);
	}
});

app.post('/api/webhooks/', async (c) => {
	const { WEBHOOK_SECRET } = env<{ WEBHOOK_SECRET: string }>(c, 'workerd');
	const db = dbInitalizer({ c });
	const svixId = c.req.raw.headers.get('svix-id');
	const svixSig = c.req.raw.headers.get('svix-signature');
	const svixTime = c.req.raw.headers.get('svix-timestamp');

	if (!WEBHOOK_SECRET) {
		return c.json(
			{
				error: 'No webhook secret provided',
			},
			403
		);
	}
	if (!svixId || !svixSig || !svixTime) {
		return c.json(
			{
				error: 'No SVIX headers provided',
			},
			400
		);
	}
	// Create a new Svix instance with secret.
	const wh = new Webhook(WEBHOOK_SECRET);

	let evt;
	const data = await c.req.json();

	// Attempt to verify the incoming webhook
	// If successful, the payload will be available from 'evt'
	// If the verification fails, error out and  return error code
	try {
		evt = wh.verify(JSON.stringify(data), {
			'svix-id': svixId,
			'svix-timestamp': svixTime,
			'svix-signature': svixSig,
		});
	} catch (err) {
		return c.json(
			{
				error: err.message,
			},
			400
		);
	}

	if (evt.type === 'user.created') {
		const formattedData = { ...data.data };
		formattedData.token = data.data.id;
		const newUser = await usersModel.createUser(db, formattedData as usersModel.User);
		if (newUser.error) {
			return c.json(
				{
					error: newUser.error,
				},
				400
			);
		}
	}

	if (evt.type === 'user.deleted') {
		const formattedData = { ...data.data };
		formattedData.token = data.data.id;

		const deletedUser = await usersModel.deleteUser(db, formattedData.token);
		if (deletedUser.error) {
			return c.json(
				{
					error: deletedUser.error,
				},
				400
			);
		}
	}

	return c.json(
		{
			user: evt,
		},
		200
	);
});

export default app;

// Export app type for client type generation
export type AppType = typeof app;
