import { Hono } from 'hono';
import * as towerReportsModel from './model';
import { dbInitalizer } from '../utils/db';
import { checkAuth, checkUserPermission } from '../utils/auth';
import type { Env } from '../index';

/**
 * Router for tower report-related API endpoints.
 * Nested under club and tower: /api/clubs/:clubId/towers/:towerId/reports
 *
 * All routes require:
 * - Authentication (checkAuth middleware)
 * - User permission and club membership (checkUserPermission middleware)
 */
export const towerReportsRouter = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
towerReportsRouter.use(checkAuth);
towerReportsRouter.use(checkUserPermission);

/**
 * GET all tower reports for a tower
 * Route: GET /api/clubs/:clubId/towers/:towerId/reports
 *
 * Retrieves all reports associated with a specific tower.
 * Returns a complete list of all reports without any filtering or pagination.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object
 * @returns JSON response with reports array, or error object with 400 status
 *
 * Success Response (200):
 * ```json
 * {
 *   "result": [
 *     {
 *       "id": 1,
 *       "tower_id": 123,
 *       "user_id": 456,
 *       "description": "Annual bell inspection completed",
 *       "report_at": "2024-11-09T10:00:00Z",
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
 * GET /api/clubs/789/towers/123/reports
 *
 * // Response
 * {
 *   "result": [...]
 * }
 * ```
 *
 * @throws Returns 400 if towerId is missing or database query fails
 */
towerReportsRouter.get('/', async (c) => {
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

		const result = await towerReportsModel.getTowerReportsByTowerId(db, parseInt(towerId, 10));
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
 * GET a tower report by ID
 * Route: GET /api/clubs/:clubId/towers/:towerId/reports/:id
 *
 * Retrieves a specific report by its ID.
 * Verifies that the report belongs to the specified tower to prevent cross-tower access.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: id, towerId, clubId
 * @returns JSON response with single report object, or error object with 400/404 status
 *
 * Success Response (200):
 * ```json
 * {
 *   "report": {
 *     "id": 1,
 *     "tower_id": 123,
 *     "user_id": 456,
 *     "description": "Annual bell inspection completed",
 *     "report_at": "2024-11-09T10:00:00Z",
 *     "created_at": "2024-11-09T10:00:00Z",
 *     "updated_at": "2024-11-09T10:00:00Z"
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 400: Missing report ID or tower ID in route, or database error
 * - 404: Report not found in this tower
 *
 * @example
 * ```typescript
 * // Request
 * GET /api/clubs/789/towers/123/reports/1
 *
 * // Success Response
 * {
 *   "report": {...}
 * }
 *
 * // Error Response (report not in tower)
 * {
 *   "error": "Report not found in this tower"
 * }
 * ```
 *
 * @remarks
 * - Report must belong to the specified tower or 404 is returned
 * - Prevents accessing reports from other towers via direct ID manipulation
 * - Returns single report object (not wrapped in array)
 *
 * @throws Returns 400 if required route params missing, 404 if report not in tower, or database error
 */
towerReportsRouter.get('/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const towerId = c.req.param('towerId');

		if (!id) {
			return c.json(
				{
					error: 'Missing report ID',
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

		const result = await towerReportsModel.getTowerReportByIdAndTowerId(
			db,
			parseInt(id, 10),
			parseInt(towerId, 10)
		);
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
					error: 'Report not found in this tower',
				},
				404
			);
		}

		return c.json({
			report: result.data[0],
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
 * POST create a new tower report
 * Route: POST /api/clubs/:clubId/towers/:towerId/reports
 *
 * Creates a new report for a specific tower.
 * The tower_id is automatically set from the route parameter.
 * The user_id is set to the authenticated user's ID.
 * Timestamps (created_at, updated_at) are automatically generated by the database.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: towerId, clubId
 * @returns JSON response with created report ID, or error object with 400/201 status
 *
 * Request Body:
 * ```json
 * {
 *   "description": "Annual bell inspection completed",
 *   "report_at": "2024-11-09T10:00:00Z"
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
 *   "error": "Missing tower ID in route" | "[Database error]"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Request
 * POST /api/clubs/789/towers/123/reports
 * Content-Type: application/json
 *
 * {
 *   "description": "Annual bell inspection completed"
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
 * - Required fields: none (tower_id and user_id are auto-set)
 * - Optional fields: description, report_at
 * - tower_id is extracted from route parameter (required)
 * - user_id is extracted from authenticated user context (required)
 * - Returns 201 (Created) status on success
 * - Auto-generated fields: id, created_at, updated_at
 *
 * @throws Returns 400 if required fields missing or database insertion fails
 */
towerReportsRouter.post('/', async (c) => {
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

		// Only allow specific fields for tower reports - prevent injection
		const reportData: towerReportsModel.TowerReport = {
			tower_id: parseInt(towerId, 10),
			user_id: typeof userId === 'string' ? parseInt(userId, 10) : userId,
			description: data.description || undefined,
			report_at: data.report_at ? new Date(data.report_at) : undefined,
		};

		const result = await towerReportsModel.createTowerReport(db, reportData);
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
 * PUT update a tower report
 * Route: PUT /api/clubs/:clubId/towers/:towerId/reports/:id
 *
 * Updates an existing report.
 * Verifies that the report belongs to the specified tower before allowing modification.
 * Preserves immutable fields (tower_id, user_id) from the existing report.
 * Only updatable fields (description, report_at) are modified.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: id, towerId, clubId
 * @returns JSON response with updated flag and report object, or error object with 400/404 status
 *
 * Request Body (all fields optional, only changed fields needed):
 * ```json
 * {
 *   "description": "Updated inspection notes",
 *   "report_at": "2024-11-09T10:00:00Z"
 * }
 * ```
 *
 * Success Response (200):
 * ```json
 * {
 *   "updated": true,
 *   "report": {
 *     "id": 1,
 *     "tower_id": 123,
 *     "user_id": 456,
 *     "description": "Updated inspection notes",
 *     "report_at": "2024-11-09T10:00:00Z",
 *     "created_at": "2024-11-09T10:00:00Z",
 *     "updated_at": "2024-11-09T10:00:00Z"
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 400: Missing report ID or tower ID, database error
 * - 404: Report not found in this tower
 *
 * @example
 * ```typescript
 * // Request
 * PUT /api/clubs/789/towers/123/reports/1
 * Content-Type: application/json
 *
 * {
 *   "description": "Updated inspection notes"
 * }
 *
 * // Response
 * {
 *   "updated": true,
 *   "report": {...}
 * }
 * ```
 *
 * @remarks
 * - tower_id and user_id cannot be changed via this endpoint (immutable)
 * - Automatically preserves existing values for immutable fields
 * - Returns full updated report object
 * - updated_at timestamp is NOT automatically refreshed (would require database trigger)
 * - Verifies report belongs to tower before allowing update (prevents cross-tower updates)
 *
 * @throws Returns 400 if required params missing or database error, 404 if report not in tower
 */
towerReportsRouter.put('/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const towerId = c.req.param('towerId');
		const data = await c.req.json();

		if (!id) {
			return c.json(
				{
					error: 'Missing report ID',
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

		// Verify report belongs to this tower
		const reportCheck = await towerReportsModel.getTowerReportByIdAndTowerId(
			db,
			parseInt(id, 10),
			parseInt(towerId, 10)
		);
		if (reportCheck.error || !reportCheck.data || reportCheck.data.length === 0) {
			return c.json(
				{
					error: 'Report not found in this tower',
				},
				404
			);
		}

		// Preserve tower_id and user_id from existing report
		const existingReport = reportCheck.data[0];
		const reportData = {
			tower_id: existingReport.tower_id,
			user_id: existingReport.user_id,
			description: data.description !== undefined ? data.description : existingReport.description,
			report_at: data.report_at !== undefined ? new Date(data.report_at) : existingReport.report_at,
		};

		const result = await towerReportsModel.updateTowerReport(db, id, reportData as towerReportsModel.TowerReport);
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
			report: result.data?.[0] || null,
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
 * DELETE a tower report
 * Route: DELETE /api/clubs/:clubId/towers/:towerId/reports/:id
 *
 * Deletes a report permanently from the database.
 * Verifies that the report belongs to the specified tower before deletion to prevent cross-tower access.
 * This operation is irreversible - the report data is permanently removed.
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
 * - 400: Missing report ID or tower ID in route, or database error
 * - 404: Report not found in this tower
 *
 * @example
 * ```typescript
 * // Request
 * DELETE /api/clubs/789/towers/123/reports/1
 *
 * // Success Response
 * {
 *   "deleted": true
 * }
 *
 * // Error Response (not found)
 * {
 *   "error": "Report not found in this tower"
 * }
 * ```
 *
 * @remarks
 * - Hard delete: Report data is permanently removed from database
 * - Verifies ownership before deletion to ensure cross-tower protection
 * - Returns 404 if report doesn't exist or belongs to different tower
 * - No soft delete or archival is implemented - data is permanently lost
 * - Consider implementing soft deletes if you need to preserve historical data
 * - No cascade rules currently defined, will fail if other records reference this report
 *
 * @throws Returns 400 if required params missing or database error, 404 if report not in tower
 */
towerReportsRouter.delete('/:id', async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const towerId = c.req.param('towerId');

		if (!id) {
			return c.json(
				{
					error: 'Missing report ID',
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

		// Verify report belongs to this tower
		const reportCheck = await towerReportsModel.getTowerReportByIdAndTowerId(
			db,
			parseInt(id, 10),
			parseInt(towerId, 10)
		);
		if (reportCheck.error || !reportCheck.data || reportCheck.data.length === 0) {
			return c.json(
				{
					error: 'Report not found in this tower',
				},
				404
			);
		}

		const result = await towerReportsModel.deleteTowerReport(db, id);
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
