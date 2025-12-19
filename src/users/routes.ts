import { Hono } from 'hono';
import * as usersModel from './model';
import { dbInitalizer } from '../utils/db';
import { checkAuth, checkUserPermission } from '../utils/auth';
import { users, usersToClubs, clubs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createClerkClient } from '@clerk/backend';
import { env } from 'hono/adapter';
import type { Env } from '../index';
import * as inviteTokensModel from '../inviteTokens/model';

export const usersRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/users
 * @description Retrieves all users in the system with their club assignments
 * @requires Authentication
 * @returns {Object} result - Array of users with their club assignments
 */
usersRouter.get('/', checkAuth, async (c) => {
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

/**
 * GET /api/users/me
 * @description Retrieves the current authenticated user's profile and club assignments
 * @requires Authentication
 * @returns {Object} user - Current user object with their clubs
 */
usersRouter.get('/me', checkAuth, async (c) => {
	try {
		if (!c.env?.DATABASE_URL) {
			console.error('[/me] Missing DATABASE_URL. env keys:', Object.keys(c.env ?? {}));
			return c.json({ error: 'Server misconfigured' }, 500);
		}

		const db = dbInitalizer({ c });
		const clerkUserId = c.var.userId;

		console.log('[/me] clerkUserId:', clerkUserId);

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
				id: user.id,
				token: user.token,
				first_name: user.first_name,
				last_name: user.last_name,
				permission: user.permission,
				clubs: userWithClubs?.clubs || [],
			},
		});
	} catch (error) {
		console.log(error);
		return c.json(
			{
				error: 'Failed to fetch user',
			},
			500
		);
	}
});

/**
 * GET /api/users/:id
 * @description Retrieves a specific user by ID with their club assignments
 * @requires Authentication and User Permission
 * @param {number} id - User ID
 * @returns {Object} user - User object with their clubs
 */
usersRouter.get('/:id', checkAuth, checkUserPermission, async (c) => {
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

/**
 * PUT /api/users/:id
 * @description Updates a user's basic information (name, permission) without modifying club assignments
 * @requires Authentication and User Permission
 * @param {number} id - User ID
 * @body {Object} data - User data to update
 * @body {string} [first_name] - User's first name
 * @body {string} [last_name] - User's last name
 * @body {number} [permission] - User's permission level
 * @returns {Object} updated - Boolean indicating success, user - Updated user object
 *
 * @example
 * PUT /api/users/5
 * Body: {
 *   "first_name": "John",
 *   "last_name": "Doe",
 *   "permission": 2
 * }
 * Response: { updated: true, user: { id: 5, ... } }
 */
usersRouter.put('/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const data = await c.req.json();

		if (!id) {
			return c.json(
				{
					error: 'Missing user ID',
				},
				400
			);
		}

		// Verify user exists
		const userResult = await db
			.select()
			.from(users)
			.where(eq(users.id, parseInt(id, 10)));
		if (userResult.length === 0) {
			return c.json(
				{
					error: 'User not found',
				},
				404
			);
		}

		// Update user with only the fields provided - do not touch token or other fields
		// Support both camelCase and snake_case field names
		const updateData: Partial<usersModel.User> = {};

		const firstName = data.first_name || data.firstName;
		const lastName = data.last_name || data.lastName;
		const permission = data.permission;

		if (firstName !== undefined) {
			updateData.first_name = firstName;
		}
		if (lastName !== undefined) {
			updateData.last_name = lastName;
		}
		if (permission !== undefined) {
			updateData.permission = permission;
		}

		// Check if there's anything to update
		if (Object.keys(updateData).length === 0) {
			return c.json(
				{
					error: 'No fields to update. Provide: first_name/firstName, last_name/lastName, or permission',
				},
				400
			);
		}

		// Build a safe update object with only allowed fields
		const result = await db
			.update(users)
			.set(updateData)
			.where(eq(users.id, parseInt(id, 10)))
			.returning();

		if (!result || result.length === 0) {
			return c.json(
				{
					error: 'Failed to update user',
				},
				400
			);
		}

		return c.json({
			updated: true,
			user: result[0],
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

/**
 * POST /api/users/register
 * @description Auto-registers a user on first-time sign-in. Creates user record if they don't exist
 * @requires Authentication
 * @body {Object} userData - User data including first_name, last_name (optional), permission, token
 * @returns {Object} created - Boolean indicating if user was created, id - User ID
 */
usersRouter.post('/register', checkAuth, async (c) => {
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

// Club-related user routes
// These handle user management within clubs

/**
 * GET /api/clubs/:clubId/users
 * @description Retrieves all users assigned to a specific club
 * @requires Authentication and User Permission
 * @param {number} clubId - Club ID
 * @returns {Object} result - Array of users with their club assignments
 */
export const clubUsersRouter = new Hono<{ Bindings: Env }>();
clubUsersRouter.use(checkAuth);
clubUsersRouter.use(checkUserPermission);

clubUsersRouter.get('/', async (c) => {
	const db = dbInitalizer({ c });
	const clubId = c.req.param('clubId');
	try {
		// Get all users assigned to this club
		const result = await db
			.select({
				user: users,
				clubs: usersToClubs,
			})
			.from(usersToClubs)
			.innerJoin(users, eq(users.id, usersToClubs.user_id))
			.where(eq(usersToClubs.club_id, parseInt(clubId, 10)));

		if (!result) {
			return c.json(
				{
					error: 'No users found for this club',
				},
				404
			);
		}

		return c.json({
			result: result,
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

/**
 * POST /api/clubs/:clubId/users
 * @description Creates a new user and assigns them to a club
 * @requires Authentication and User Permission
 * @param {number} clubId - Club ID
 * @body {Object} userData - User data including first_name, last_name (optional), permission, token
 * @returns {Object} created, id, assigned_to_club, club_id
 */
clubUsersRouter.post('/', async (c) => {
	const db = dbInitalizer({ c });
	const clubId = c.req.param('clubId');
	const formattedData = await c.req.json();

	try {
		// Create new user
		const newUser = await usersModel.createUser(db, formattedData as usersModel.User);

		if (newUser.error) {
			return c.json(
				{
					error: newUser.error,
				},
				400
			);
		}

		const userId = newUser.data[0].id;

		// Automatically assign the user to the club
		const clubAssignment = await usersModel.assignClubToUser(db, userId.toString(), clubId, formattedData.permission || 'member');

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
				created: true,
				id: userId,
				assigned_to_club: true,
				club_id: parseInt(clubId, 10),
			},
			200
		);
	} catch (error) {
		return c.json(
			{
				error: error.message || 'Failed to create user',
			},
			400
		);
	}
});

/**
 * PUT /api/clubs/:clubId/users/:userId
 * @description Updates a user's role/permission within a club
 * @requires Authentication and User Permission
 * @param {number} clubId - Club ID
 * @param {number} userId - User ID
 * @body {Object} data - Update data including permission
 * @returns {Object} updated, user_id, club_id, permission
 */
clubUsersRouter.put('/:userId', async (c) => {
	const db = dbInitalizer({ c });
	const clubId = c.req.param('clubId');
	const userId = c.req.param('userId');
	const data = await c.req.json();

	try {
		// Update user's role/permission within the club
		const clubAssignment = await usersModel.assignClubToUser(db, userId, clubId, data.permission);

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
				updated: true,
				user_id: parseInt(userId, 10),
				club_id: parseInt(clubId, 10),
				permission: data.permission,
				data: clubAssignment.data,
			},
			200
		);
	} catch (error) {
		return c.json(
			{
				error: error.message || 'Failed to update user in club',
			},
			400
		);
	}
});

/**
 * DELETE /api/clubs/:clubId/users/:userId
 * @description Deletes a user from Clerk (removes entire user account)
 * @requires Authentication and User Permission
 * @param {number} clubId - Club ID
 * @param {number} userId - User ID
 * @returns {Object} deleted, user_id, club_id
 */
clubUsersRouter.delete('/:userId', async (c) => {
	const { CLERK_PRIVATE_KEY } = env<{ CLERK_PRIVATE_KEY: string }>(c, 'workerd');
	const clubId = c.req.param('clubId');
	const userId = c.req.param('userId');

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
			user_id: parseInt(userId, 10),
			club_id: parseInt(clubId, 10),
		},
		200
	);
});

/**
 * DELETE /api/clubs/:clubId/users/:userId/club
 * @description Removes a user from a club without deleting their account
 * @requires Authentication and User Permission
 * @param {number} clubId - Club ID
 * @param {number} userId - User ID
 * @returns {Object} removed, user_id, club_id
 */
clubUsersRouter.delete('/:userId/club', async (c) => {
	const db = dbInitalizer({ c });
	const clubId = c.req.param('clubId');
	const userId = c.req.param('userId');

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

/**
 * POST /api/clubs/:clubId/join
 * @description Joins an existing user to a club using an invite token
 * @requires Authentication and User Permission
 * @param {number} clubId - Club ID
 * @query {string} invite - Invite token
 * @body {Object} body - Optional override data with rolePermission
 * @returns {Object} joined, club_id, user_id, club_name, role_assigned
 */
clubUsersRouter.post('/join', async (c) => {
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

		// Use the already-retrieved database user ID from checkUserPermission middleware
		// c.var.userId is now the database user ID, no need to look it up again
		const lhUserId = c.var.userId;

		// Get club ID from route parameter
		const clubId = c.req.param('clubId');

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
