import { Hono } from 'hono';
import * as scheduledSessionsModel from './model';
import { dbInitalizer } from '../utils/db';
import { checkAuth, checkUserPermission } from '../utils/auth';
import type { Env } from '../index';

export const scheduledSessionsRouter = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
scheduledSessionsRouter.use(checkAuth);
scheduledSessionsRouter.use(checkUserPermission);

/**
 * GET /api/clubs/:id/scheduled-sessions
 * Retrieve all scheduled sessions for a specific club
 */
scheduledSessionsRouter.get('/', async (c) => {
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

		const result = await scheduledSessionsModel.getScheduledSessionsByClubId(db, clubId);
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

/**
 * GET /api/clubs/:id/scheduled-sessions/:sessionId
 * Retrieve a specific scheduled session by ID
 */
scheduledSessionsRouter.get('/:sessionId', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const sessionId = c.req.param('sessionId');
		const clubId = c.req.param('clubId');

		if (!sessionId) {
			return c.json(
				{
					error: 'Missing session ID',
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

		const result = await scheduledSessionsModel.getScheduledSessionById(db, sessionId);
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
					error: 'Scheduled session not found',
				},
				404
			);
		}

		// Verify session belongs to this club
		const session = result.data[0];
		if (session.club_id !== parseInt(clubId, 10)) {
			return c.json(
				{
					error: 'Scheduled session not found in this club',
				},
				404
			);
		}

		return c.json({
			session: session,
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
 * POST /api/clubs/:id/scheduled-sessions
 * Create a new scheduled session in a club
 */
scheduledSessionsRouter.post('/', async (c) => {
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

		if (!data.schedule) {
			return c.json(
				{
					error: 'Missing required field: schedule',
				},
				400
			);
		}

		const sessionData: scheduledSessionsModel.ScheduledSession = {
			id: 0,
			schedule: new Date(data.schedule),
			club_id: parseInt(clubId, 10),
			description: data.description || undefined,
		};

		const result = await scheduledSessionsModel.createScheduledSession(db, sessionData);
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
				session: result.data?.[0],
			},
			201
		);
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
 * PUT /api/clubs/:id/scheduled-sessions/:sessionId
 * Update a scheduled session
 */
scheduledSessionsRouter.put('/:sessionId', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const sessionId = c.req.param('sessionId');
		const clubId = c.req.param('clubId');
		const data = await c.req.json();

		if (!sessionId) {
			return c.json(
				{
					error: 'Missing session ID',
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

		// Verify session belongs to this club
		const sessionCheck = await scheduledSessionsModel.getScheduledSessionById(db, sessionId);
		if (sessionCheck.error || !sessionCheck.data || sessionCheck.data.length === 0) {
			return c.json(
				{
					error: 'Scheduled session not found',
				},
				404
			);
		}

		const session = sessionCheck.data[0];
		if (session.club_id !== parseInt(clubId, 10)) {
			return c.json(
				{
					error: 'Scheduled session not found in this club',
				},
				404
			);
		}

		const updateData: any = {};
		if (data.schedule) {
			updateData.schedule = new Date(data.schedule);
		}
		if (data.description !== undefined) {
			updateData.description = data.description;
		}

		const result = await scheduledSessionsModel.updateScheduledSession(db, sessionId, updateData);
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
			session: result.data?.[0] || null,
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
 * DELETE /api/clubs/:id/scheduled-sessions/:sessionId
 * Delete a scheduled session from a club
 */
scheduledSessionsRouter.delete('/:sessionId', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const sessionId = c.req.param('sessionId');
		const clubId = c.req.param('clubId');

		if (!sessionId) {
			return c.json(
				{
					error: 'Missing session ID',
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

		// Verify session belongs to this club
		const sessionCheck = await scheduledSessionsModel.getScheduledSessionById(db, sessionId);
		if (sessionCheck.error || !sessionCheck.data || sessionCheck.data.length === 0) {
			return c.json(
				{
					error: 'Scheduled session not found',
				},
				404
			);
		}

		const session = sessionCheck.data[0];
		if (session.club_id !== parseInt(clubId, 10)) {
			return c.json(
				{
					error: 'Scheduled session not found in this club',
				},
				404
			);
		}

		const result = await scheduledSessionsModel.deleteScheduledSession(db, sessionId);
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
				error: error instanceof Error ? error.message : String(error),
			},
			400
		);
	}
});
