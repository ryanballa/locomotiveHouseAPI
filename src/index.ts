// src/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { addresses, consists } from './db/schema';
import { Hono } from 'hono';
import * as addressesModel from './addresses/model';
import * as consistsModel from './consists/model';

export type Env = {
	DATABASE_URL: string;
};

const dbInitalizer = function ({ c }: any) {
	const sql = neon(c.env.DATABASE_URL);
	return drizzle(sql);
};

const app = new Hono<{ Bindings: Env }>();

app.get('/api/addresses/', async (c) => {
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

app.post('/api/addresses/', async (c) => {
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

app.put('/api/addresses/:id', async (c) => {
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

app.delete('/api/addresses/:id', async (c) => {
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

app.get('/api/consists/', async (c) => {
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

app.post('/api/consists/', async (c) => {
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

app.delete('/api/consists/:id', async (c) => {
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
