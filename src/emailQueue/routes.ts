import { Hono } from 'hono';
import { emailQueueModel } from './model';
import { dbInitalizer } from '../utils/db';
import type { Env } from '../index';

/**
 * Router for email queue API endpoints.
 * Base route: /api/email-queue
 *
 * All routes require:
 * - API Key authentication (X-API-Key header) - checkApiKey middleware
 * - Bearer token authentication (JWT or M2M token) - checkEmailQueueAuth middleware
 *
 * NOTE: Middlewares must be applied separately when mounting this router,
 * as they are defined in the main index.ts file.
 */
export const emailQueueRouter = new Hono<{ Bindings: Env }>();

// Note: checkApiKey and checkEmailQueueAuth middlewares are applied
// when mounting this router in index.ts, not here

/**
 * POST create a new email in the queue
 * Route: POST /api/email-queue/
 *
 * Creates a new email entry in the queue for processing by external email services.
 * The email will be set to 'pending' status and can be picked up by the mailer service.
 *
 * Authentication:
 * - Requires valid X-API-Key header (checkApiKey middleware)
 * - Requires valid Bearer token (JWT or M2M) (checkEmailQueueAuth middleware)
 *
 * @param c - Hono context object
 * @returns JSON response with created email data, or error object with appropriate status
 *
 * Request Body:
 * ```json
 * {
 *   "recipient_email": "user@example.com",
 *   "subject": "Welcome Email",
 *   "body": "Plain text body",
 *   "html_body": "<p>HTML body</p>",
 *   "max_retries": 3,
 *   "scheduled_at": "2024-11-09T10:00:00Z"
 * }
 * ```
 *
 * Success Response (201):
 * ```json
 * {
 *   "data": {
 *     "id": 1,
 *     "recipient_email": "user@example.com",
 *     "subject": "Welcome Email",
 *     "body": "Plain text body",
 *     "html_body": "<p>HTML body</p>",
 *     "status": "pending",
 *     "retry_count": 0,
 *     "max_retries": 3,
 *     "last_error": null,
 *     "scheduled_at": "2024-11-09T10:00:00Z",
 *     "sent_at": null,
 *     "created_at": "2024-11-09T09:00:00Z",
 *     "updated_at": "2024-11-09T09:00:00Z"
 *   }
 * }
 * ```
 *
 * Error Response (400):
 * ```json
 * {
 *   "error": "Missing required fields: recipient_email, subject, body"
 * }
 * ```
 *
 * @remarks
 * - Required fields: recipient_email, subject, body
 * - Optional fields: html_body, max_retries (default: 3), scheduled_at
 * - Auto-generated fields: id, status, retry_count, last_error, sent_at, created_at, updated_at
 *
 * @throws Returns 400 if required fields missing, 500 if database insertion fails
 */
emailQueueRouter.post('/', async (c) => {
	const db = dbInitalizer({ c });

	try {
		const body = await c.req.json();

		// Validate required fields
		if (!body.recipient_email || !body.subject || !body.body) {
			return c.json({ error: 'Missing required fields: recipient_email, subject, body' }, 400);
		}

		const result = await emailQueueModel.createEmail(db, {
			recipient_email: body.recipient_email,
			subject: body.subject,
			body: body.body,
			html_body: body.html_body,
			max_retries: body.max_retries ?? 3,
			scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : undefined,
		});

		if (result.error) {
			return c.json({ error: result.error }, 400);
		}

		return c.json({ data: result.data }, 201);
	} catch (error) {
		return c.json({ error: `Failed to create email: ${error}` }, 500);
	}
});

/**
 * GET list emails with optional filtering
 * Route: GET /api/email-queue/
 *
 * Retrieves a list of emails from the queue with optional filtering and pagination.
 * Supports filtering by status and ordering results.
 *
 * Authentication:
 * - Requires valid X-API-Key header (checkApiKey middleware)
 * - Requires valid Bearer token (JWT or M2M) (checkEmailQueueAuth middleware)
 *
 * @param c - Hono context object
 * @returns JSON response with array of email records, or error object
 *
 * Query Parameters:
 * - status: 'pending' | 'sent' | 'failed' (optional)
 * - limit: number (default: 50, max recommended: 100)
 * - offset: number (default: 0)
 * - order: 'asc' | 'desc' (default: 'desc')
 *
 * Success Response (200):
 * ```json
 * {
 *   "data": [
 *     {
 *       "id": 1,
 *       "recipient_email": "user@example.com",
 *       "subject": "Welcome Email",
 *       ...
 *     }
 *   ]
 * }
 * ```
 *
 * Error Response (400):
 * ```json
 * {
 *   "error": "Failed to list emails: [error details]"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Request
 * GET /api/email-queue/?status=pending&limit=10&order=asc
 *
 * // Response
 * {
 *   "data": [...]
 * }
 * ```
 *
 * @throws Returns 400 if database query fails, 500 for unexpected errors
 */
emailQueueRouter.get('/', async (c) => {
	const db = dbInitalizer({ c });

	try {
		const status = c.req.query('status') as 'pending' | 'sent' | 'failed' | undefined;
		const limit = parseInt(c.req.query('limit') || '50', 10);
		const offset = parseInt(c.req.query('offset') || '0', 10);
		const order = (c.req.query('order') || 'desc') as 'asc' | 'desc';

		const result = await emailQueueModel.listEmails(db, {
			status,
			limit,
			offset,
			order,
		});

		if (result.error) {
			return c.json({ error: result.error }, 400);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to list emails: ${error}` }, 500);
	}
});

/**
 * GET pending emails for processing
 * Route: GET /api/email-queue/pending/list
 *
 * Retrieves pending emails ready to be sent, ordered by oldest first (FIFO).
 * This endpoint is specifically designed for external email services to poll for work.
 *
 * Authentication:
 * - Requires valid X-API-Key header (checkApiKey middleware)
 * - Requires valid Bearer token (JWT or M2M) (checkEmailQueueAuth middleware)
 *
 * @param c - Hono context object
 * @returns JSON response with array of pending email records
 *
 * Query Parameters:
 * - limit: number (default: 10, controls batch size for processing)
 *
 * Success Response (200):
 * ```json
 * {
 *   "data": [
 *     {
 *       "id": 1,
 *       "recipient_email": "user@example.com",
 *       "status": "pending",
 *       ...
 *     }
 *   ]
 * }
 * ```
 *
 * @remarks
 * - Returns only emails with status='pending'
 * - Ordered by created_at (oldest first) for FIFO processing
 * - External services should call this endpoint on a polling interval
 *
 * @throws Returns 400 if database query fails, 500 for unexpected errors
 */
emailQueueRouter.get('/pending/list', async (c) => {
	const db = dbInitalizer({ c });

	try {
		const limit = parseInt(c.req.query('limit') || '10', 10);
		const result = await emailQueueModel.getPendingEmails(db, limit);

		if (result.error) {
			return c.json({ error: result.error }, 400);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to fetch pending emails: ${error}` }, 500);
	}
});

/**
 * GET failed emails for retry processing
 * Route: GET /api/email-queue/failed/list
 *
 * Retrieves failed emails for manual inspection or retry processing.
 * Returns emails with status='failed', ordered by most recent failures first.
 *
 * Authentication:
 * - Requires valid X-API-Key header (checkApiKey middleware)
 * - Requires valid Bearer token (JWT or M2M) (checkEmailQueueAuth middleware)
 *
 * @param c - Hono context object
 * @returns JSON response with array of failed email records
 *
 * Query Parameters:
 * - limit: number (default: 10)
 *
 * Success Response (200):
 * ```json
 * {
 *   "data": [
 *     {
 *       "id": 1,
 *       "status": "failed",
 *       "last_error": "SMTP connection failed",
 *       "retry_count": 3,
 *       ...
 *     }
 *   ]
 * }
 * ```
 *
 * @remarks
 * - Returns only emails with status='failed'
 * - Ordered by updated_at (most recent first)
 * - Useful for monitoring and manual intervention
 *
 * @throws Returns 400 if database query fails, 500 for unexpected errors
 */
emailQueueRouter.get('/failed/list', async (c) => {
	const db = dbInitalizer({ c });

	try {
		const limit = parseInt(c.req.query('limit') || '10', 10);
		const result = await emailQueueModel.getFailedEmails(db, limit);

		if (result.error) {
			return c.json({ error: result.error }, 400);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to fetch failed emails: ${error}` }, 500);
	}
});

/**
 * GET an email by ID
 * Route: GET /api/email-queue/:id
 *
 * Retrieves a specific email record by its ID.
 *
 * Authentication:
 * - Requires valid X-API-Key header (checkApiKey middleware)
 * - Requires valid Bearer token (JWT or M2M) (checkEmailQueueAuth middleware)
 *
 * @param c - Hono context object with route params: id
 * @returns JSON response with email record, or error object with 400/404 status
 *
 * Success Response (200):
 * ```json
 * {
 *   "data": {
 *     "id": 1,
 *     "recipient_email": "user@example.com",
 *     "subject": "Welcome Email",
 *     "body": "Plain text body",
 *     "status": "sent",
 *     ...
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 400: Invalid email ID (not a number)
 * - 404: Email not found
 *
 * @throws Returns 400 if ID is invalid, 404 if email not found, 500 for unexpected errors
 */
emailQueueRouter.get('/:id', async (c) => {
	const db = dbInitalizer({ c });
	const id = parseInt(c.req.param('id'), 10);

	if (isNaN(id)) {
		return c.json({ error: 'Invalid email ID' }, 400);
	}

	try {
		const result = await emailQueueModel.getEmail(db, id);

		if (result.error) {
			return c.json({ error: result.error }, 404);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to fetch email: ${error}` }, 500);
	}
});

/**
 * PUT update an email record
 * Route: PUT /api/email-queue/:id
 *
 * Updates an existing email record in the queue.
 * Typically used by external email services to update status, retry count, or error information.
 *
 * Authentication:
 * - Requires valid X-API-Key header (checkApiKey middleware)
 * - Requires valid Bearer token (JWT or M2M) (checkEmailQueueAuth middleware)
 *
 * @param c - Hono context object with route params: id
 * @returns JSON response with updated email record, or error object
 *
 * Request Body (all fields optional):
 * ```json
 * {
 *   "status": "sent",
 *   "retry_count": 1,
 *   "last_error": "SMTP timeout",
 *   "sent_at": "2024-11-09T10:00:00Z"
 * }
 * ```
 *
 * Success Response (200):
 * ```json
 * {
 *   "data": {
 *     "id": 1,
 *     "status": "sent",
 *     "retry_count": 1,
 *     "sent_at": "2024-11-09T10:00:00Z",
 *     ...
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 400: Invalid email ID (not a number)
 * - 404: Email not found
 *
 * @remarks
 * - Updated fields: status, retry_count, last_error, sent_at
 * - updated_at timestamp is automatically refreshed
 * - Used by mailer services to mark emails as sent or failed
 *
 * @throws Returns 400 if ID is invalid, 404 if email not found, 500 for unexpected errors
 */
emailQueueRouter.put('/:id', async (c) => {
	const db = dbInitalizer({ c });
	const id = parseInt(c.req.param('id'), 10);

	if (isNaN(id)) {
		return c.json({ error: 'Invalid email ID' }, 400);
	}

	try {
		const body = await c.req.json();

		const result = await emailQueueModel.updateEmail(db, id, {
			status: body.status,
			retry_count: body.retry_count,
			last_error: body.last_error,
			sent_at: body.sent_at ? new Date(body.sent_at) : undefined,
		});

		if (result.error) {
			return c.json({ error: result.error }, 404);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to update email: ${error}` }, 500);
	}
});

/**
 * DELETE an email from the queue
 * Route: DELETE /api/email-queue/:id
 *
 * Permanently deletes an email record from the queue.
 * This operation is irreversible - the email data is permanently removed.
 *
 * Authentication:
 * - Requires valid X-API-Key header (checkApiKey middleware)
 * - Requires valid Bearer token (JWT or M2M) (checkEmailQueueAuth middleware)
 *
 * @param c - Hono context object with route params: id
 * @returns JSON response with deleted email data, or error object
 *
 * Success Response (200):
 * ```json
 * {
 *   "data": {
 *     "id": 1
 *   }
 * }
 * ```
 *
 * Error Responses:
 * - 400: Invalid email ID (not a number)
 * - 404: Email not found
 *
 * @remarks
 * - Hard delete: Email data is permanently removed from database
 * - No soft delete or archival is implemented
 * - Consider implementing soft deletes if you need to preserve historical data
 *
 * @throws Returns 400 if ID is invalid, 404 if email not found, 500 for unexpected errors
 */
emailQueueRouter.delete('/:id', async (c) => {
	const db = dbInitalizer({ c });
	const id = parseInt(c.req.param('id'), 10);

	if (isNaN(id)) {
		return c.json({ error: 'Invalid email ID' }, 400);
	}

	try {
		const result = await emailQueueModel.deleteEmail(db, id);

		if (result.error) {
			return c.json({ error: result.error }, 404);
		}

		return c.json({ data: result.data });
	} catch (error) {
		return c.json({ error: `Failed to delete email: ${error}` }, 500);
	}
});
