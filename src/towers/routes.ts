import { Hono } from 'hono';
import * as towersModel from './model';
import { dbInitalizer } from '../utils/db';
import { checkAuth, checkUserPermission } from '../utils/auth';
import { towers } from '../db/schema';
import type { Env } from '../index';

export const towersRouter = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
towersRouter.use(checkAuth);
towersRouter.use(checkUserPermission);

// GET all towers for a club
towersRouter.get('/', async (c) => {
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

		const result = await towersModel.getTowersByClubId(db, parseInt(clubId, 10));
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

// GET tower by ID (from specific club)
towersRouter.get('/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubId = c.req.param('clubId');

		if (!id) {
			return c.json(
				{
					error: 'Missing tower ID',
				},
				400
			);
		}

		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID in route',
				},
				400
			);
		}

		const result = await towersModel.getTowerByIdAndClubId(db, parseInt(id, 10), parseInt(clubId, 10));
		if (result.error) {
			return c.json(
				{
					error: result.error,
				},
				400
			);
		}

		if (!result.data || result.data.length === 0) {
			return c.json(
				{
					error: 'Tower not found in this club',
				},
				404
			);
		}

		return c.json({
			tower: result.data[0],
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

// POST create tower in a club
towersRouter.post('/', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const clubId = c.req.param('clubId');
		const data = await c.req.json();

		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID in route',
				},
				400
			);
		}

		// Set club_id from route parameter
		const towerData = {
			...data,
			club_id: parseInt(clubId, 10),
		};

		const result = await towersModel.createTower(db, towerData as towersModel.Tower);
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
				created: true,
				id: result.data?.[0]?.id,
			},
			201
		);
	} catch (error) {
		return c.json(
			{
				error,
			},
			400
		);
	}
});

// PUT update tower in a club
towersRouter.put('/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubId = c.req.param('clubId');
		const data = await c.req.json();

		if (!id) {
			return c.json(
				{
					error: 'Missing tower ID',
				},
				400
			);
		}

		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID in route',
				},
				400
			);
		}

		// Verify tower belongs to this club
		const towerCheck = await towersModel.getTowerByIdAndClubId(db, parseInt(id, 10), parseInt(clubId, 10));
		if (towerCheck.error || !towerCheck.data || towerCheck.data.length === 0) {
			return c.json(
				{
					error: 'Tower not found in this club',
				},
				404
			);
		}

		// Set club_id from route parameter
		const towerData = {
			...data,
			club_id: parseInt(clubId, 10),
		};

		const result = await towersModel.updateTower(db, id, towerData as towersModel.Tower);
		if (result.error) {
			return c.json(
				{
					error: result.error,
				},
				400
			);
		}

		return c.json({
			updated: true,
			tower: result.data?.[0] || null,
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

// DELETE tower from a club
towersRouter.delete('/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubId = c.req.param('clubId');

		if (!id) {
			return c.json(
				{
					error: 'Missing tower ID',
				},
				400
			);
		}

		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID in route',
				},
				400
			);
		}

		// Verify tower belongs to this club
		const towerCheck = await towersModel.getTowerByIdAndClubId(db, parseInt(id, 10), parseInt(clubId, 10));
		if (towerCheck.error || !towerCheck.data || towerCheck.data.length === 0) {
			return c.json(
				{
					error: 'Tower not found in this club',
				},
				404
			);
		}

		const result = await towersModel.deleteTower(db, id);
		if (result.error) {
			return c.json(
				{
					error: result.error,
				},
				400
			);
		}

		return c.json({
			deleted: true,
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
