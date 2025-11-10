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
import { towersRouter } from './towers/routes';
import { issuesRouter } from './issues/routes';
import { cors } from 'hono/cors';
import { eq, and } from 'drizzle-orm';

export type Env = {
	DATABASE_URL: string;
	WEBHOOK_SECRET: string;
	CLERK_PRIVATE_KEY: string;
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
		return c.json({ error: 'Unauthenticated' }, 403);
	}
};

const checkUserPermission = async function (c, next) {
	const db = dbInitalizer({ c });
	const clerkUserId = c.var.userId;

	// Find user in database by clerk ID
	const userResult = await getUserIdFromClerkId(db, clerkUserId);

	if (!userResult) {
		return c.json({ error: 'User not found in database' }, 403);
	}

	return next();
};

const checkAdminPermission = async function (c, next) {
	const db = dbInitalizer({ c });
	const clerkUserId = c.var.userId;

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
			return ALLOWED_ORIGIN;
		},
	})
);

// Mount towers routes
app.route('/api/clubs/:clubId/towers', towersRouter);

// Mount issues routes
app.route('/api/clubs/:clubId/towers/:towerId/issues', issuesRouter);

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
	const clerkUserId = c.var.userId;

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
		const clerkUserId = c.var.userId;

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
	const clerkUserId = c.var.userId;

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

app.get('/api/clubs/:id', checkAuth, checkAdminPermission, async (c) => {
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

app.get('/api/clubs/:id/addresses', checkAuth, checkAdminPermission, async (c) => {
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

app.get('/api/users/', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const result = await usersModel.getAllUsersWithClubs(db);

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
				error,
			},
			400
		);
	}
});

app.get('/api/users/me', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	const clerkUserId = c.var.userId;

	try {
		// Get user by their Clerk ID (stored in token field)
		const result = await usersModel.getUser(db, clerkUserId);

		if (!result.data || result.data.length === 0) {
			return c.json(
				{
					error: 'User not found',
				},
				401
			);
		}

		const user = result.data[0];

		// Get user's club assignments
		const userWithClubs = await usersModel.getUserWithClubs(db, user.id);

		return c.json({
			user: {
				...user,
				clubs: userWithClubs?.clubs || [],
			},
		});
	} catch (error) {
		return c.json(
			{
				error: 'Failed to fetch user',
			},
			500
		);
	}
});

app.get('/api/users/:id/', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const userWithClubs = await usersModel.getUserWithClubs(db, parseInt(id, 10));

		if (!userWithClubs) {
			return c.json(
				{
					error: 'User not found',
				},
				404
			);
		}

		return c.json({
			user: userWithClubs.user,
			clubs: userWithClubs.clubs,
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

// Auto-register endpoint for first-time sign-in (no permission check needed)
app.post('/api/users/register', checkAuth, async (c) => {
	const { CLERK_PRIVATE_KEY } = env<{ CLERK_PRIVATE_KEY: string }>(c, 'workerd');
	const db = dbInitalizer({ c });
	const clerkUserId = c.var.userId;
	const clerkClient = await createClerkClient({ secretKey: CLERK_PRIVATE_KEY });

	try {
		// Check if user already exists in database
		const existingUsers = await db.select().from(users).where(eq(users.token, clerkUserId));

		if (existingUsers.length > 0) {
			// User already exists, return their ID
			const user = existingUsers[0];

			// Update Clerk metadata if not already set
			const clerkUser = await clerkClient.users.getUser(clerkUserId);
			if (!clerkUser.privateMetadata.lhUserId) {
				await clerkClient.users.updateUserMetadata(clerkUserId, {
					privateMetadata: {
						lhUserId: user.id,
					},
				});
			}

			return c.json({
				created: false,
				id: user.id,
				message: 'User already exists',
			});
		}

		// Create new user
		const formattedData = await c.req.json();

		const newUser = await usersModel.createUser(db, formattedData as usersModel.User);

		if (newUser.error) {
			console.error('User creation error:', newUser.error);
			return c.json(
				{
					error: newUser.error,
				},
				400
			);
		}

		const userId = newUser.data[0].id;

		// Update Clerk user metadata with the new lhUserId
		await clerkClient.users.updateUserMetadata(clerkUserId, {
			privateMetadata: {
				lhUserId: userId,
			},
		});

		return c.json(
			{
				created: true,
				id: userId,
			},
			200
		);
	} catch (error) {
		console.error('Register endpoint error:', error);
		return c.json(
			{
				error: error.message || 'Failed to register user',
			},
			500
		);
	}
});

app.post('/api/users/', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const formattedData = await c.req.json();

	const newUser = await usersModel.createUser(db, formattedData as usersModel.User);

	if (newUser.error) {
		return c.json(
			{
				error: newUser.error,
			},
			400
		);
	}
	return c.json(
		{
			created: true,
			id: newUser.data[0].id,
		},
		200
	);
});

app.put('/api/users/:id/', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const data = await c.req.json();

	// Handle club assignment if club_id is provided
	if (data.club_id) {
		const clubAssignment = await usersModel.assignClubToUser(db, id, data.club_id);

		if (clubAssignment.error) {
			return c.json(
				{
					error: clubAssignment.error,
				},
				400
			);
		}

		return c.json(
			{
				assigned: true,
				club_id: data.club_id,
				data: clubAssignment.data,
			},
			200
		);
	}

	// Handle user update (token, permission)
	const formattedData = { id: id, token: data.token, permission: data.permission };

	const updatedUser = await usersModel.updateUser(db, id, formattedData as usersModel.User);

	if (updatedUser.error) {
		return c.json(
			{
				error: updatedUser.error,
			},
			400
		);
	}
	return c.json(
		{
			updatedUser,
		},
		200
	);
});

app.delete('/api/users/:id/', checkAuth, checkUserPermission, async (c) => {
	const { CLERK_PRIVATE_KEY } = env<{ CLERK_PRIVATE_KEY: string }>(c, 'workerd');

	const data = await c.req.json();
	const deletedUser = await usersModel.deleteUser(CLERK_PRIVATE_KEY, data as usersModel.User);

	if (deletedUser.error) {
		return c.json(
			{
				error: deletedUser.error,
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

app.delete('/api/users/:id/clubs/:clubId', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const userId = c.req.param('id');
	const clubId = c.req.param('clubId');

	const result = await usersModel.removeClubFromUser(db, userId, clubId);

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
			removed: true,
			user_id: parseInt(userId, 10),
			club_id: parseInt(clubId, 10),
		},
		200
	);
});

app.post('/api/clubs/:id/join', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const { CLERK_PRIVATE_KEY } = env<{
		CLERK_PRIVATE_KEY: string;
	}>(c, 'workerd');

	try {
		// Get invite token from query parameter
		const inviteToken = c.req.query('invite');

		if (!inviteToken) {
			return c.json(
				{
					error: 'Missing invite token',
				},
				400
			);
		}

		// Validate invite token
		const tokenValidation = await inviteTokensModel.validateInviteToken(db, inviteToken);

		if (tokenValidation.error) {
			return c.json(
				{
					error: tokenValidation.error,
				},
				400
			);
		}

		// Find user in database by clerk ID
		const userIdResult = await getUserIdFromClerkId(db, c.var.userId);

		if (!userIdResult) {
			return c.json({ error: 'User not found in database' }, 403);
		}

		const lhUserId = userIdResult.id;

		// Get club ID from route parameter
		const clubId = c.req.param('id');

		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID',
				},
				400
			);
		}

		// Verify the invite token is for the correct club
		if (tokenValidation.data?.club_id !== parseInt(clubId, 10)) {
			return c.json(
				{
					error: 'Invalid invite token for this club',
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

		// Get the role permission from invite token
		const rolePermission = tokenValidation.data?.role_permission;

		// Optionally get rolePermission from request body as well (for overrides)
		let requestBodyRolePermission;
		try {
			const body = await c.req.json().catch(() => ({}));
			requestBodyRolePermission = body.rolePermission || body.role_permission;
		} catch {
			// Body is optional
		}

		// Use body role permission if provided, otherwise use invite token role permission
		const finalRolePermission = requestBodyRolePermission ? parseInt(requestBodyRolePermission, 10) : rolePermission;

		// Assign user to club with optional role permission
		const assignmentResult = await usersModel.assignClubToUser(db, lhUserId.toString(), parseInt(clubId, 10), finalRolePermission);

		if (assignmentResult.error) {
			return c.json(
				{
					error: assignmentResult.error,
				},
				400
			);
		}

		return c.json(
			{
				joined: true,
				club_id: parseInt(clubId, 10),
				user_id: lhUserId,
				club_name: clubResult[0].name,
				role_assigned: finalRolePermission || null,
			},
			200
		);
	} catch (error) {
		console.error('Error joining club:', error);
		return c.json(
			{
				error: 'Failed to join club',
			},
			500
		);
	}
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
	const clerkUserId = c.var.userId;

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
	const clerkUserId = c.var.userId;

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
