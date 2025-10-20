// src/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { Webhook } from 'svix';
import { neon } from '@neondatabase/serverless';
import { addresses, consists, clubs, usersToClubs, users, permissions, appointments } from './db/schema';
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
import { cors } from 'hono/cors';
import { eq } from 'drizzle-orm';

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
		const payload = JSON.parse(temp[1]);
		const token = payload.jwt;

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
	const { CLERK_PRIVATE_KEY } = env<{
		CLERK_PRIVATE_KEY: string;
	}>(c, 'workerd');
	const clerkClient = await createClerkClient({ secretKey: CLERK_PRIVATE_KEY });
	const user = await clerkClient.users.getUser(c.var.userId);

	if (user.privateMetadata.lhUserId) {
		return next();
	}

	return c.json(
		{
			error: 'Missing permission',
		},
		403
	);
};

const checkAdminPermission = async function (c, next) {
	const { CLERK_PRIVATE_KEY } = env<{
		CLERK_PRIVATE_KEY: string;
	}>(c, 'workerd');
	const db = dbInitalizer({ c });
	const clerkClient = await createClerkClient({ secretKey: CLERK_PRIVATE_KEY });
	const clerkUser = await clerkClient.users.getUser(c.var.userId);
	const lhUserId = clerkUser.privateMetadata.lhUserId as number;

	if (!lhUserId) {
		return c.json(
			{
				error: 'User not registered',
			},
			403
		);
	}

	try {
		// Get user with their permission
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

		if (userPermission?.title === 'admin') {
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

const dbInitalizer = function ({ c }: any) {
	const sql = neon(c.env.DATABASE_URL);
	return drizzle(sql);
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
});

app.put('/api/addresses/:id', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const data = await c.req.json();
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

app.delete('/api/addresses/:id', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
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

app.get('/api/clubs/:id', checkAuth, checkAdminPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubResult = await db.select().from(clubs).where(eq(clubs.id, parseInt(id, 10)));

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
		const result = await db.select().from(users);
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
	const { CLERK_PRIVATE_KEY } = env<{ CLERK_PRIVATE_KEY: string }>(c, 'workerd');
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const data = await c.req.json();
	const clerkUserId = c.var.userId;

	// Get the current user's lhUserId
	const clerkClient = await createClerkClient({ secretKey: CLERK_PRIVATE_KEY });
	const clerkUser = await clerkClient.users.getUser(clerkUserId);
	const lhUserId = clerkUser.privateMetadata.lhUserId as number;

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
	const { CLERK_PRIVATE_KEY } = env<{ CLERK_PRIVATE_KEY: string }>(c, 'workerd');
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const clerkUserId = c.var.userId;

	// Get the current user's lhUserId
	const clerkClient = await createClerkClient({ secretKey: CLERK_PRIVATE_KEY });
	const clerkUser = await clerkClient.users.getUser(clerkUserId);
	const lhUserId = clerkUser.privateMetadata.lhUserId as number;

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
