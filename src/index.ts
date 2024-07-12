// src/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { addresses, consists } from './db/schema';
import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { createClerkClient, verifyToken } from '@clerk/backend';
import * as addressesModel from './addresses/model';
import * as consistsModel from './consists/model';
import { cors } from 'hono/cors';

export type Env = {
	DATABASE_URL: string;
	CLERK_JWT_KEY: string;
};

const checkAuth = async function (c, next) {
	const { CLERK_JWT_KEY } = env<{ CLERK_SECRET_KEY: string; CLERK_JWT_KEY: string }>(c, 'workerd');
	const Clerk = createClerkClient({ jwtKey: CLERK_JWT_KEY });
	const token = c.req.raw.headers.get('authorization');
	if (token) {
		const temp = token.split('Bearer ');
		if (temp[1] != undefined) {
			const token = JSON.parse(temp[1]).jwt;
			const verfication = await verifyToken(token, {
				//authorizedParties: ['http://localhost:5173', 'https://clerk.dev'],
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

export default app;
