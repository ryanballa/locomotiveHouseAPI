import { Hono } from 'hono';
import * as issuesModel from './model';
import { dbInitalizer } from '../utils/db';
import { checkAuth, checkUserPermission } from '../utils/auth';
import { issues } from '../db/schema';
import type { Env } from '../index';

/**
 * Router for issue-related API endpoints.
 * Nested under club and tower: /api/clubs/:clubId/towers/:towerId/issues
 *
 * All routes require:
 * - Authentication (checkAuth middleware)
 * - User permission and club membership (checkUserPermission middleware)
 */
export const issuesRouter = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
issuesRouter.use(checkAuth);
issuesRouter.use(checkUserPermission);

/**
 * GET all issues for a tower
 * Route: GET /api/clubs/:clubId/towers/:towerId/issues
 *
 * Retrieves all issues associated with a specific tower.
 * Returns a complete list of all issues without any filtering or pagination.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object
 * @returns JSON response with issues array, or error object with 400 status
 *
 * Success Response (200):
 * ```json
 * {
 *   "result": [
 *     {
 *       "id": 1,
 *       "tower_id": 123,
 *       "user_id": 456,
 *       "title": "Broken escalator",
 *       "type": "maintenance",
 *       "description": "Floor 3 escalator not operational",
 *       "created_at": "2024-11-09T10:00:00Z",
 *       "updated_at": "2024-11-09T10:00:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * Error Response (400):
 * ```json
 * {
 *   "error": "Missing tower ID in route" | "[Database error]"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Request
 * GET /api/clubs/789/towers/123/issues
 *
 * // Response
 * {
 *   "result": [...]
 * }
 * ```
 *
 * @throws Returns 400 if towerId is missing or database query fails
 */
issuesRouter.get('/', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const towerId = c.req.param('towerId');

		if (!towerId) {
			return c.json(
				{
					error: 'Missing tower ID in route',
				},
				400
			);
		}

		const result = await issuesModel.getIssuesByTowerId(db, parseInt(towerId, 10));
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
 * GET an issue by ID
 * Route: GET /api/clubs/:clubId/towers/:towerId/issues/:id
 *
 * Retrieves a specific issue by its ID.
 * Verifies that the issue belongs to the specified tower to prevent cross-tower access.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: id, towerId, clubId
 * @returns JSON response with single issue object, or error object with 400/404 status
 *
 * Success Response (200):
 * ```json
 * {
 *   "issue": {
 *     "id": 1,
 *     "tower_id": 123,
 *     "user_id": 456,
 *     "title": "Broken escalator",
 *     "type": "maintenance",
 *     "description": "Floor 3 escalator not operational",
 *     "created_at": "2024-11-09T10:00:00Z",
 *     "updated_at": "2024-11-09T10:00:00Z"
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 400: Missing issue ID or tower ID in route, or database error
 * - 404: Issue not found in this tower
 *
 * @example
 * ```typescript
 * // Request
 * GET /api/clubs/789/towers/123/issues/1
 *
 * // Success Response
 * {
 *   "issue": {...}
 * }
 *
 * // Error Response (issue not in tower)
 * {
 *   "error": "Issue not found in this tower"
 * }
 * ```
 *
 * @remarks
 * - Issue must belong to the specified tower or 404 is returned
 * - Prevents accessing issues from other towers via direct ID manipulation
 * - Returns single issue object (not wrapped in array)
 *
 * @throws Returns 400 if required route params missing, 404 if issue not in tower, or database error
 */
issuesRouter.get('/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const towerId = c.req.param('towerId');

		if (!id) {
			return c.json(
				{
					error: 'Missing issue ID',
				},
				400
			);
		}

		if (!towerId) {
			return c.json(
				{
					error: 'Missing tower ID in route',
				},
				400
			);
		}

		const result = await issuesModel.getIssueByIdAndTowerId(db, parseInt(id, 10), parseInt(towerId, 10));
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
					error: 'Issue not found in this tower',
				},
				404
			);
		}

		return c.json({
			issue: result.data[0],
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
 * POST create a new issue
 * Route: POST /api/clubs/:clubId/towers/:towerId/issues
 *
 * Creates a new issue for a specific tower.
 * The tower_id is automatically set from the route parameter.
 * The user_id is set to the authenticated user's ID (currently defaults to 1 - TODO: use actual authenticated user).
 * Timestamps (created_at, updated_at) are automatically generated by the database.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: towerId, clubId
 * @returns JSON response with created issue ID, or error object with 400/201 status
 *
 * Request Body:
 * ```json
 * {
 *   "title": "Broken escalator",
 *   "type": "maintenance",
 *   "description": "The escalator on floor 3 is not working"
 * }
 * ```
 *
 * Success Response (201):
 * ```json
 * {
 *   "created": true,
 *   "id": 1
 * }
 * ```
 *
 * Error Response (400):
 * ```json
 * {
 *   "error": "Missing tower ID in route" | "Missing required fields: title, type" | "[Database error]"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Request
 * POST /api/clubs/789/towers/123/issues
 * Content-Type: application/json
 *
 * {
 *   "title": "Broken escalator",
 *   "type": "maintenance",
 *   "description": "Floor 3 escalator not operational"
 * }
 *
 * // Response
 * {
 *   "created": true,
 *   "id": 1
 * }
 * ```
 *
 * @remarks
 * - Required fields: title, type
 * - Optional fields: description
 * - tower_id is extracted from route parameter and required
 * - user_id currently defaults to 1 (TODO: use actual authenticated user from context)
 * - Returns 201 (Created) status on success
 * - Auto-generated fields: id, created_at, updated_at
 *
 * @throws Returns 400 if required fields missing or database insertion fails
 */
issuesRouter.post('/', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const towerId = c.req.param('towerId');
		const data = await c.req.json();
		const userId = c.var.userId;

		if (!towerId) {
			return c.json(
				{
					error: 'Missing tower ID in route',
				},
				400
			);
		}

		// Validate required fields
		if (!data.title || !data.type) {
			return c.json(
				{
					error: 'Missing required fields: title, type',
				},
				400
			);
		}

		// Set tower_id and user_id from route/context
		// Note: user_id would be looked up from clerk ID in a real implementation
		const issueData = {
			...data,
			tower_id: parseInt(towerId, 10),
			user_id: data.user_id || 1, // TODO: Get actual user ID from authenticated user
		};

		const result = await issuesModel.createIssue(db, issueData as issuesModel.Issue);
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

/**
 * PUT update an issue
 * Route: PUT /api/clubs/:clubId/towers/:towerId/issues/:id
 *
 * Updates an existing issue.
 * Verifies that the issue belongs to the specified tower before allowing modification.
 * Preserves immutable fields (tower_id, user_id) from the existing issue.
 * Only updatable fields (title, type, description) are modified.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: id, towerId, clubId
 * @returns JSON response with updated flag and issue object, or error object with 400/404 status
 *
 * Request Body (all fields optional, only changed fields needed):
 * ```json
 * {
 *   "title": "Fixed escalator",
 *   "type": "resolved",
 *   "description": "Issue was resolved on 2024-11-09"
 * }
 * ```
 *
 * Success Response (200):
 * ```json
 * {
 *   "updated": true,
 *   "issue": {
 *     "id": 1,
 *     "tower_id": 123,
 *     "user_id": 456,
 *     "title": "Fixed escalator",
 *     "type": "resolved",
 *     "description": "Issue was resolved on 2024-11-09",
 *     "created_at": "2024-11-09T10:00:00Z",
 *     "updated_at": "2024-11-09T10:00:00Z"
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 400: Missing issue ID or tower ID, database error
 * - 404: Issue not found in this tower
 *
 * @example
 * ```typescript
 * // Request
 * PUT /api/clubs/789/towers/123/issues/1
 * Content-Type: application/json
 *
 * {
 *   "title": "Fixed escalator",
 *   "type": "resolved"
 * }
 *
 * // Response
 * {
 *   "updated": true,
 *   "issue": {...}
 * }
 * ```
 *
 * @remarks
 * - tower_id and user_id cannot be changed via this endpoint (immutable)
 * - Automatically preserves existing values for immutable fields
 * - Returns full updated issue object
 * - updated_at timestamp is NOT automatically refreshed (would require database trigger)
 * - Verifies issue belongs to tower before allowing update (prevents cross-tower updates)
 *
 * @throws Returns 400 if required params missing or database error, 404 if issue not in tower
 */
issuesRouter.put('/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const towerId = c.req.param('towerId');
		const data = await c.req.json();

		if (!id) {
			return c.json(
				{
					error: 'Missing issue ID',
				},
				400
			);
		}

		if (!towerId) {
			return c.json(
				{
					error: 'Missing tower ID in route',
				},
				400
			);
		}

		// Verify issue belongs to this tower
		const issueCheck = await issuesModel.getIssueByIdAndTowerId(
			db,
			parseInt(id, 10),
			parseInt(towerId, 10)
		);
		if (issueCheck.error || !issueCheck.data || issueCheck.data.length === 0) {
			return c.json(
				{
					error: 'Issue not found in this tower',
				},
				404
			);
		}

		// Preserve tower_id and user_id from existing issue
		const existingIssue = issueCheck.data[0];
		const issueData = {
			tower_id: existingIssue.tower_id,
			user_id: existingIssue.user_id,
			title: data.title || existingIssue.title,
			type: data.type || existingIssue.type,
			status: data.status !== undefined ? data.status : existingIssue.status,
			description: data.description !== undefined ? data.description : existingIssue.description,
		};

		const result = await issuesModel.updateIssue(db, id, issueData as issuesModel.Issue);
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
			issue: result.data?.[0] || null,
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
 * DELETE an issue
 * Route: DELETE /api/clubs/:clubId/towers/:towerId/issues/:id
 *
 * Deletes an issue permanently from the database.
 * Verifies that the issue belongs to the specified tower before deletion to prevent cross-tower access.
 * This operation is irreversible - the issue data is permanently removed.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: id, towerId, clubId
 * @returns JSON response with deleted flag, or error object with 400/404 status
 *
 * Success Response (200):
 * ```json
 * {
 *   "deleted": true
 * }
 * ```
 *
 * Error Responses:
 * - 400: Missing issue ID or tower ID in route, or database error
 * - 404: Issue not found in this tower
 *
 * @example
 * ```typescript
 * // Request
 * DELETE /api/clubs/789/towers/123/issues/1
 *
 * // Success Response
 * {
 *   "deleted": true
 * }
 *
 * // Error Response (not found)
 * {
 *   "error": "Issue not found in this tower"
 * }
 * ```
 *
 * @remarks
 * - Hard delete: Issue data is permanently removed from database
 * - Verifies ownership before deletion to ensure cross-tower protection
 * - Returns 404 if issue doesn't exist or belongs to different tower
 * - No soft delete or archival is implemented - data is permanently lost
 * - Consider implementing soft deletes if you need to preserve historical data
 * - No cascade rules currently defined, will fail if other records reference this issue
 *
 * @throws Returns 400 if required params missing or database error, 404 if issue not in tower
 */
issuesRouter.delete('/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const towerId = c.req.param('towerId');

		if (!id) {
			return c.json(
				{
					error: 'Missing issue ID',
				},
				400
			);
		}

		if (!towerId) {
			return c.json(
				{
					error: 'Missing tower ID in route',
				},
				400
			);
		}

		// Verify issue belongs to this tower
		const issueCheck = await issuesModel.getIssueByIdAndTowerId(
			db,
			parseInt(id, 10),
			parseInt(towerId, 10)
		);
		if (issueCheck.error || !issueCheck.data || issueCheck.data.length === 0) {
			return c.json(
				{
					error: 'Issue not found in this tower',
				},
				404
			);
		}

		const result = await issuesModel.deleteIssue(db, id);
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
