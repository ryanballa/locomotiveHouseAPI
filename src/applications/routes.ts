import { Hono } from 'hono';
import * as applicationsModel from './model';
import { dbInitalizer } from '../utils/db';
import { checkAuth, checkUserPermission } from '../utils/auth';
import type { Env } from '../index';

/**
 * Router for application-related API endpoints.
 * Nested under club: /api/clubs/:clubId/applications
 *
 * Authentication requirements:
 * - POST (create application): No authentication required (public endpoint)
 * - GET, PUT, DELETE: Require authentication and user permission
 */
export const applicationsRouter = new Hono<{ Bindings: Env }>();

/**
 * GET all applications for a club
 * Route: GET /api/clubs/:clubId/applications
 *
 * Retrieves all applications associated with a specific club.
 * Returns a complete list of all applications without any filtering or pagination.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object
 * @returns JSON response with applications array, or error object with 400 status
 *
 * Success Response (200):
 * ```json
 * {
 *   "result": [
 *     {
 *       "id": 1,
 *       "club_id": 123,
 *       "name": "John Doe",
 *       "email": "john@example.com",
 *       "occupation": "Engineer",
 *       "will_agree_to_club_rules": true,
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
 *   "error": "Missing club ID in route" | "[Database error]"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Request
 * GET /api/clubs/123/applications
 *
 * // Response
 * {
 *   "result": [...]
 * }
 * ```
 *
 * @throws Returns 400 if clubId is missing or database query fails
 */
applicationsRouter.get('/', checkAuth, checkUserPermission, async (c) => {
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

		const result = await applicationsModel.getApplicationsByClubId(db, parseInt(clubId, 10));
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
 * GET an application by ID
 * Route: GET /api/clubs/:clubId/applications/:id
 *
 * Retrieves a specific application by its ID.
 * Verifies that the application belongs to the specified club to prevent cross-club access.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: id, clubId
 * @returns JSON response with single application object, or error object with 400/404 status
 *
 * Success Response (200):
 * ```json
 * {
 *   "application": {
 *     "id": 1,
 *     "club_id": 123,
 *     "name": "John Doe",
 *     "email": "john@example.com",
 *     "occupation": "Engineer",
 *     "will_agree_to_club_rules": true,
 *     "created_at": "2024-11-09T10:00:00Z",
 *     "updated_at": "2024-11-09T10:00:00Z"
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 400: Missing application ID or club ID in route, or database error
 * - 404: Application not found in this club
 *
 * @example
 * ```typescript
 * // Request
 * GET /api/clubs/123/applications/1
 *
 * // Success Response
 * {
 *   "application": {...}
 * }
 *
 * // Error Response (application not in club)
 * {
 *   "error": "Application not found in this club"
 * }
 * ```
 *
 * @remarks
 * - Application must belong to the specified club or 404 is returned
 * - Prevents accessing applications from other clubs via direct ID manipulation
 * - Returns single application object (not wrapped in array)
 *
 * @throws Returns 400 if required route params missing, 404 if application not in club, or database error
 */
applicationsRouter.get('/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubId = c.req.param('clubId');

		if (!id) {
			return c.json(
				{
					error: 'Missing application ID',
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

		const result = await applicationsModel.getApplicationByIdAndClubId(db, parseInt(id, 10), parseInt(clubId, 10));
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
					error: 'Application not found in this club',
				},
				404
			);
		}

		return c.json({
			application: result.data[0],
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
 * POST create a new application
 * Route: POST /api/clubs/:clubId/applications
 *
 * Creates a new application for a specific club.
 * The club_id is automatically set from the route parameter.
 * Timestamps (created_at, updated_at) are automatically generated by the database.
 *
 * Authentication & Authorization:
 * - No authentication required (public endpoint for new applicants)
 * - Anyone can submit an application to a club
 *
 * @param c - Hono context object with route params: clubId
 * @returns JSON response with created application ID, or error object with 400/201 status
 *
 * Request Body (all fields optional except what's set from route):
 * ```json
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "birthday": "1990-01-01T00:00:00Z",
 *   "occupation": "Engineer",
 *   "interested_scale": "HO",
 *   "special_interests": "Steam locomotives",
 *   "has_home_layout": true,
 *   "collection_size": "Large",
 *   "has_other_model_railroad_associations": false,
 *   "will_agree_to_club_rules": true
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
 *   "error": "Missing club ID in route" | "[Database error]"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Request
 * POST /api/clubs/123/applications
 * Content-Type: application/json
 *
 * {
 *   "name": "John Doe",
 *   "email": "john@example.com",
 *   "occupation": "Engineer"
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
 * - All fields are optional except club_id which is set from route
 * - club_id is extracted from route parameter and required
 * - Returns 201 (Created) status on success
 * - Auto-generated fields: id, created_at, updated_at
 *
 * @throws Returns 400 if club ID missing or database insertion fails
 */
applicationsRouter.post('/', async (c) => {
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

		if (!data.phone_number) {
			return c.json(
				{
					error: 'Phone number is required',
				},
				400
			);
		}

		// Validate age requirement if birthday is provided
		if (data.birthday) {
			const birthdayDate = new Date(data.birthday);
			const today = new Date();
			const age = today.getFullYear() - birthdayDate.getFullYear();
			const monthDiff = today.getMonth() - birthdayDate.getMonth();
			const dayDiff = today.getDate() - birthdayDate.getDate();

			// Adjust age if birthday hasn't occurred yet this year
			const actualAge = (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ? age - 1 : age;

			if (actualAge < 18) {
				return c.json(
					{
						error: 'Applicant must be 18 years or older. A parent or guardian needs to apply on their behalf.',
					},
					400
				);
			}
		}

		// Only allow specific fields for applications - prevent injection
		const applicationData: applicationsModel.Application = {
			club_id: parseInt(clubId, 10),
			name: data.name || undefined,
			email: data.email || undefined,
			phone_number: data.phone_number,
			birthday: data.birthday ? new Date(data.birthday) : undefined,
			occupation: data.occupation || undefined,
			interested_scale: data.interested_scale || undefined,
			interest_length: data.interest_length || undefined,
			special_interests: data.special_interests || undefined,
			has_home_layout: data.has_home_layout !== undefined ? data.has_home_layout : undefined,
			collection_size: data.collection_size || undefined,
			has_other_model_railroad_associations: data.has_other_model_railroad_associations !== undefined ? data.has_other_model_railroad_associations : undefined,
			will_agree_to_club_rules: data.will_agree_to_club_rules !== undefined ? data.will_agree_to_club_rules : undefined,
		};

		const result = await applicationsModel.createApplication(db, applicationData);
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
 * PUT update an application
 * Route: PUT /api/clubs/:clubId/applications/:id
 *
 * Updates an existing application.
 * Verifies that the application belongs to the specified club before allowing modification.
 * Preserves the immutable club_id field from the existing application.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: id, clubId
 * @returns JSON response with updated flag and application object, or error object with 400/404 status
 *
 * Request Body (all fields optional, only changed fields needed):
 * ```json
 * {
 *   "name": "Jane Doe",
 *   "email": "jane@example.com",
 *   "occupation": "Designer"
 * }
 * ```
 *
 * Success Response (200):
 * ```json
 * {
 *   "updated": true,
 *   "application": {
 *     "id": 1,
 *     "club_id": 123,
 *     "name": "Jane Doe",
 *     "email": "jane@example.com",
 *     "occupation": "Designer",
 *     "created_at": "2024-11-09T10:00:00Z",
 *     "updated_at": "2024-11-09T10:00:00Z"
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 400: Missing application ID or club ID, database error
 * - 404: Application not found in this club
 *
 * @example
 * ```typescript
 * // Request
 * PUT /api/clubs/123/applications/1
 * Content-Type: application/json
 *
 * {
 *   "name": "Jane Doe",
 *   "email": "jane@example.com"
 * }
 *
 * // Response
 * {
 *   "updated": true,
 *   "application": {...}
 * }
 * ```
 *
 * @remarks
 * - club_id cannot be changed via this endpoint (immutable)
 * - Automatically preserves existing values for fields not provided
 * - Returns full updated application object
 * - updated_at timestamp is automatically refreshed
 * - Verifies application belongs to club before allowing update (prevents cross-club updates)
 *
 * @throws Returns 400 if required params missing or database error, 404 if application not in club
 */
applicationsRouter.put('/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubId = c.req.param('clubId');
		const data = await c.req.json();

		if (!id) {
			return c.json(
				{
					error: 'Missing application ID',
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

		// Verify application belongs to this club
		const applicationCheck = await applicationsModel.getApplicationByIdAndClubId(
			db,
			parseInt(id, 10),
			parseInt(clubId, 10)
		);
		if (applicationCheck.error || !applicationCheck.data || applicationCheck.data.length === 0) {
			return c.json(
				{
					error: 'Application not found in this club',
				},
				404
			);
		}

		// Preserve club_id from existing application
		const existingApplication = applicationCheck.data[0];
		const applicationData: applicationsModel.Application = {
			club_id: existingApplication.club_id,
			name: data.name !== undefined ? data.name : existingApplication.name,
			email: data.email !== undefined ? data.email : existingApplication.email,
			phone_number: data.phone_number !== undefined ? data.phone_number : existingApplication.phone_number,
			birthday: data.birthday !== undefined ? (data.birthday ? new Date(data.birthday) : null) : existingApplication.birthday,
			occupation: data.occupation !== undefined ? data.occupation : existingApplication.occupation,
			interested_scale: data.interested_scale !== undefined ? data.interested_scale : existingApplication.interested_scale,
			interest_length: data.interest_length !== undefined ? data.interest_length : existingApplication.interest_length,
			special_interests: data.special_interests !== undefined ? data.special_interests : existingApplication.special_interests,
			has_home_layout: data.has_home_layout !== undefined ? data.has_home_layout : existingApplication.has_home_layout,
			collection_size: data.collection_size !== undefined ? data.collection_size : existingApplication.collection_size,
			has_other_model_railroad_associations: data.has_other_model_railroad_associations !== undefined ? data.has_other_model_railroad_associations : existingApplication.has_other_model_railroad_associations,
			will_agree_to_club_rules: data.will_agree_to_club_rules !== undefined ? data.will_agree_to_club_rules : existingApplication.will_agree_to_club_rules,
		};

		const result = await applicationsModel.updateApplication(db, id, applicationData);
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
			application: result.data?.[0] || null,
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
 * DELETE an application
 * Route: DELETE /api/clubs/:clubId/applications/:id
 *
 * Deletes an application permanently from the database.
 * Verifies that the application belongs to the specified club before deletion to prevent cross-club access.
 * This operation is irreversible - the application data is permanently removed.
 *
 * Authentication & Authorization:
 * - Requires valid Clerk JWT token (checkAuth middleware)
 * - User must be authenticated in database (checkUserPermission middleware)
 * - User must be admin/super-admin, OR belong to the specified club
 *
 * @param c - Hono context object with route params: id, clubId
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
 * - 400: Missing application ID or club ID in route, or database error
 * - 404: Application not found in this club
 *
 * @example
 * ```typescript
 * // Request
 * DELETE /api/clubs/123/applications/1
 *
 * // Success Response
 * {
 *   "deleted": true
 * }
 *
 * // Error Response (not found)
 * {
 *   "error": "Application not found in this club"
 * }
 * ```
 *
 * @remarks
 * - Hard delete: Application data is permanently removed from database
 * - Verifies ownership before deletion to ensure cross-club protection
 * - Returns 404 if application doesn't exist or belongs to different club
 * - No soft delete or archival is implemented - data is permanently lost
 * - Consider implementing soft deletes if you need to preserve historical data
 * - No cascade rules currently defined, will fail if other records reference this application
 *
 * @throws Returns 400 if required params missing or database error, 404 if application not in club
 */
applicationsRouter.delete('/:id', checkAuth, checkUserPermission, async (c) => {
	const db = dbInitalizer({ c });
	try {
		const id = c.req.param('id');
		const clubId = c.req.param('clubId');

		if (!id) {
			return c.json(
				{
					error: 'Missing application ID',
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

		// Verify application belongs to this club
		const applicationCheck = await applicationsModel.getApplicationByIdAndClubId(
			db,
			parseInt(id, 10),
			parseInt(clubId, 10)
		);
		if (applicationCheck.error || !applicationCheck.data || applicationCheck.data.length === 0) {
			return c.json(
				{
					error: 'Application not found in this club',
				},
				404
			);
		}

		const result = await applicationsModel.deleteApplication(db, id);
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
