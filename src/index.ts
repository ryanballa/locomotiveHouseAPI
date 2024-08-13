// src/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { Webhook } from 'svix';
import { neon } from '@neondatabase/serverless';
import { addresses, consists, clubs } from './db/schema';
import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { verifyToken } from '@clerk/backend';
import * as addressesModel from './addresses/model';
import * as consistsModel from './consists/model';
import * as clubsModel from './clubs/model';
import { cors } from 'hono/cors';

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
			await verifyToken(token, {
				authorizedParties: [ALLOWED_PARTIES],
				jwtKey: CLERK_JWT_KEY,
			});
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

const dbInitalizer = function ({ c }: any) {
	const sql = neon(c.env.DATABASE_URL);
	return drizzle(sql);
};

const app = new Hono<{ Bindings: Env }>();

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
		console.log(error);
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
		console.log(error);
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
		console.log('Error verifying the webhook:', err.message);
		return c.json(
			{
				error: err.message,
			},
			400
		);
	}

	return c.json(
		{
			user: evt,
		},
		200
	);
});

export default app;
