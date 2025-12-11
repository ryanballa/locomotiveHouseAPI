import { Hono } from 'hono';
import * as noticesModel from './model';
import { dbInitalizer } from '../utils/db';
import { checkAuth, checkUserPermission } from '../utils/auth';
import type { Env } from '../index';

/**
 * Notices Router
 * Handles all CRUD operations for notices within a club
 *
 * Routes:
 * - GET  /api/clubs/:clubId/notices?public=true - Get public notices (no auth)
 * - GET  /api/clubs/:clubId/notices             - Get all notices for a club (auth required)
 * - GET  /api/clubs/:clubId/notices/:id         - Get a specific notice
 * - POST /api/clubs/:clubId/notices             - Create a new notice
 * - PUT  /api/clubs/:clubId/notices/:id         - Update a notice
 * - DELETE /api/clubs/:clubId/notices/:id       - Delete a notice
 */
export const noticesRouter = new Hono<{ Bindings: Env }>();

/**
 * GET all notices for a club
 *
 * PUBLIC ROUTE when ?public=true query parameter is provided (no authentication required)
 * Retrieves all notices associated with a specific club.
 *
 * @route GET /api/clubs/:clubId/notices?public=true (public, no auth)
 * @route GET /api/clubs/:clubId/notices (requires authentication)
 * @param {string} clubId - Club ID (from route parameter)
 * @param {string} [public] - Query parameter to get public notices only (no auth required)
 * @returns {object} Object containing array of notices
 *
 * @example
 * GET /api/clubs/1/notices?public=true (no auth required)
 * Response: { result: [{ id: 1, club_id: 1, description: "...", type: "alert", is_public: true, ... }] }
 *
 * @example
 * GET /api/clubs/1/notices (requires auth)
 * Response: { result: [{ id: 1, club_id: 1, description: "...", type: "alert", ... }] }
 */
noticesRouter.get('/', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const clubId = c.req.param('clubId');
		const isPublic = c.req.query('public');

		if (!clubId) {
			return c.json(
				{
					error: 'Missing club ID in route',
				},
				400
			);
		}

		// PUBLIC ROUTE - no authentication required when public=true
		if (isPublic === 'true') {
			const result = await noticesModel.getPublicNoticesByClubId(db, parseInt(clubId, 10));
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
		}

		// PROTECTED ROUTE - authentication required
		// Manually apply auth middleware for non-public requests
		const authResult = await checkAuth(c, async () => {});
		if (authResult) return authResult; // Auth failed, return error response

		const permResult = await checkUserPermission(c, async () => {});
		if (permResult) return permResult; // Permission check failed

		const result = await noticesModel.getNoticesByClubId(db, parseInt(clubId, 10));
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
 * GET a specific notice by ID
 *
 * Retrieves a single notice by its ID, verifying it belongs
 * to the specified club. Requires authentication.
 *
 * @route GET /api/clubs/:clubId/notices/:id
 * @param {string} id - Notice ID (from route parameter)
 * @param {string} clubId - Club ID (from route parameter)
 * @returns {object} Object containing the notice details
 *
 * @example
 * GET /api/clubs/1/notices/5
 * Response: { notice: { id: 5, club_id: 1, description: "...", ... } }
 */
noticesRouter.get('/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubId = c.req.param('clubId');

		if (!id) {
			return c.json(
				{
					error: 'Missing notice ID',
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

		const result = await noticesModel.getNoticeByIdAndClubId(db, parseInt(id, 10), parseInt(clubId, 10));
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
					error: 'Notice not found in this club',
				},
				404
			);
		}

		return c.json({
			notice: result.data[0],
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
 * POST create a new notice in a club
 *
 * Creates a new notice with the provided details. The club_id is
 * extracted from the route parameter to ensure the notice is
 * created in the correct club. Requires authentication.
 *
 * @route POST /api/clubs/:clubId/notices
 * @param {string} clubId - Club ID (from route parameter)
 * @body {object} Request body
 * @body {string} description - Notice description (required)
 * @body {string} [type] - Notice type/category (optional)
 * @body {string} [expires_at] - ISO date string for expiration (optional)
 * @returns {object} Object with created flag and new notice ID
 *
 * @example
 * POST /api/clubs/1/notices
 * Body: {
 *   "description": "System maintenance scheduled",
 *   "type": "maintenance",
 *   "expires_at": "2024-12-01T00:00:00Z"
 * }
 * Response: { created: true, id: 5 }
 */
noticesRouter.post('/', checkAuth, checkUserPermission, async (c) => {
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

		// Only allow specific fields for notices - prevent injection
		const noticeData: noticesModel.Notice = {
			club_id: parseInt(clubId, 10),
			description: data.description,
			type: data.type || undefined,
			is_public: data.is_public || undefined,
			expires_at: data.expires_at ? new Date(data.expires_at) : undefined,
		};

		const result = await noticesModel.createNotice(db, noticeData);
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
				error: error instanceof Error ? error.message : String(error),
			},
			400
		);
	}
});

/**
 * PUT update an existing notice
 *
 * Updates notice details. Verifies the notice belongs to the
 * specified club before updating. Requires authentication.
 *
 * @route PUT /api/clubs/:clubId/notices/:id
 * @param {string} id - Notice ID (from route parameter)
 * @param {string} clubId - Club ID (from route parameter)
 * @body {object} Request body
 * @body {string} [description] - Updated description
 * @body {string} [type] - Updated type/category
 * @body {string} [expires_at] - Updated expiration date
 * @returns {object} Object with updated flag and notice details
 *
 * @example
 * PUT /api/clubs/1/notices/5
 * Body: {
 *   "description": "Updated notice text",
 *   "type": "alert"
 * }
 * Response: { updated: true, notice: { id: 5, ... } }
 */
noticesRouter.put('/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubId = c.req.param('clubId');
		const data = await c.req.json();

		if (!id) {
			return c.json(
				{
					error: 'Missing notice ID',
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

		// Verify notice belongs to this club
		const noticeCheck = await noticesModel.getNoticeByIdAndClubId(db, parseInt(id, 10), parseInt(clubId, 10));
		if (noticeCheck.error || !noticeCheck.data || noticeCheck.data.length === 0) {
			return c.json(
				{
					error: 'Notice not found in this club',
				},
				404
			);
		}

		// Set club_id from route parameter
		const noticeData: noticesModel.Notice = {
			club_id: parseInt(clubId, 10),
			description: data.description || noticeCheck.data[0].description,
			type: data.type !== undefined ? data.type : noticeCheck.data[0].type,
			is_public: data.is_public !== undefined ? data.is_public : noticeCheck.data[0].is_public,
			expires_at: data.expires_at ? new Date(data.expires_at) : noticeCheck.data[0].expires_at,
		};

		const result = await noticesModel.updateNotice(db, id, noticeData);
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
			notice: result.data?.[0] || null,
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
 * DELETE a notice from a club
 *
 * Deletes a notice by ID, verifying it belongs to the specified club
 * before deletion. Requires authentication.
 *
 * @route DELETE /api/clubs/:clubId/notices/:id
 * @param {string} id - Notice ID (from route parameter)
 * @param {string} clubId - Club ID (from route parameter)
 * @returns {object} Object with deleted flag
 *
 * @example
 * DELETE /api/clubs/1/notices/5
 * Response: { deleted: true }
 */
noticesRouter.delete('/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubId = c.req.param('clubId');

		if (!id) {
			return c.json(
				{
					error: 'Missing notice ID',
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

		// Verify notice belongs to this club
		const noticeCheck = await noticesModel.getNoticeByIdAndClubId(db, parseInt(id, 10), parseInt(clubId, 10));
		if (noticeCheck.error || !noticeCheck.data || noticeCheck.data.length === 0) {
			return c.json(
				{
					error: 'Notice not found in this club',
				},
				404
			);
		}

		const result = await noticesModel.deleteNotice(db, id);
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
