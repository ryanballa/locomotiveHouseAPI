// src/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { Webhook } from 'svix';
import { neon } from '@neondatabase/serverless';
import { addresses, consists, clubs, usersToClubs, users, permissions } from './db/schema';
import { Hono } from 'hono';
import { etag } from 'hono/etag';
import { env } from 'hono/adapter';
import { logger } from 'hono/logger';
import { verifyToken } from '@clerk/backend';
import * as addressesModel from './addresses/model';
import * as consistsModel from './consists/model';
import * as usersModel from './users/model';
import * as clubsModel from './clubs/model';
import { cors } from 'hono/cors';
import { check } from 'drizzle-orm/mysql-core';

export type Env = {
	DATABASE_URL: string;
	CLERK_JWT_KEY: string;
	WEBHOOK_SECRET: string;
};

const checkAuth = async function (c, next) {
	const { CLERK_JWT_KEY, ALLOWED_PARTIES } = env<{ ALLOWED_PARTIES: string; CLERK_JWT_KEY: string }>(c, 'workerd');
	const token = c.req.raw.headers.get('authorization');
	if (token) {
		const temp = token.split('Bearer ');
		if (temp[1] != undefined) {
			const token = JSON.parse(temp[1]).jwt;
			const verification = await verifyToken(token, {
				authorizedParties: [ALLOWED_PARTIES],
				jwtKey: CLERK_JWT_KEY,
			});

			if (!c.req.raw.headers.get('X-User-ID')) {
				const db = dbInitalizer({ c });
				const user = await usersModel.getUser(db, verification.userId);
				if (user.data && user.data[0]) {
					c.header('X-User-ID', user.data[0].id);
				}
			}
			return next();
		}
	}
	return c.json(
		{
			error: 'Unauthenticated',
		},
		403
	);
};

const checkUserPermission = async function (c, next) {
	const data = await c.req.json();
	if (c.req.raw.headers.get('X-User-ID') === data.user_id) {
		return next();
	}
	return c.json(
		{
			error: 'Unauthorized',
		},
		403
	);
};

const dbInitalizer = function ({ c }: any) {
	const sql = neon(c.env.DATABASE_URL);
	return drizzle(sql);
};

const app = new Hono<{ Bindings: Env }>();
app.use('/etag/*', etag());
app.use(logger());

app.onError((err, c) => {
	return c.text('Internal Server Error', 500);
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

app.post('/api/addresses/', checkAuth, async (c) => {
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
		console.log(err);
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
		console.log(err);
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

app.get('/api/clubs/assignments/', checkAuth, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const result = await db.select().from(usersToClubs);
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

app.post('/api/consists/', checkAuth, async (c) => {
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

app.post('/api/users/:id/', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	const id = c.req.param('id');
	const formattedData = { token: id };

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
