/**
 * Email Queue Model
 *
 * Provides database operations for managing the email queue.
 * This module handles CRUD operations for email queue entries and
 * utilities to fetch pending/failed emails for processing by external services.
 *
 * @module emailQueue/model
 */

import { emailQueue } from '../db/schema';
import { eq, asc, desc } from 'drizzle-orm';

/**
 * Email Queue Item
 *
 * Represents an email in the queue
 *
 * @interface EmailQueueItem
 * @property {number} id - Unique identifier for the email
 * @property {string} recipient_email - Email address of recipient
 * @property {string} subject - Email subject line
 * @property {string} body - Plain text body of the email
 * @property {string | null} html_body - Optional HTML version of the email body
 * @property {'pending' | 'sent' | 'failed'} status - Current status of the email
 * @property {number} retry_count - Number of times sending has been attempted
 * @property {number} max_retries - Maximum number of retry attempts allowed
 * @property {string | null} last_error - Error message from last failed attempt
 * @property {Date | null} scheduled_at - Optional datetime to send the email
 * @property {Date | null} sent_at - Datetime when email was successfully sent
 * @property {Date} created_at - Datetime when record was created
 * @property {Date} updated_at - Datetime when record was last updated
 */
export interface EmailQueueItem {
	id: number;
	recipient_email: string;
	subject: string;
	body: string;
	html_body?: string | null;
	status: 'pending' | 'sent' | 'failed';
	retry_count: number;
	max_retries: number;
	last_error?: string | null;
	scheduled_at?: Date | null;
	sent_at?: Date | null;
	created_at: Date;
	updated_at: Date;
}

/**
 * Create Email Queue Request
 *
 * Request payload for creating a new email in the queue
 *
 * @interface CreateEmailQueueRequest
 * @property {string} recipient_email - Email address of recipient (required)
 * @property {string} subject - Email subject line (required)
 * @property {string} body - Plain text body of the email (required)
 * @property {string} [html_body] - Optional HTML version of the body
 * @property {number} [max_retries=3] - Maximum retry attempts before marking as failed
 * @property {Date} [scheduled_at] - Optional datetime to defer sending
 */
export interface CreateEmailQueueRequest {
	recipient_email: string;
	subject: string;
	body: string;
	html_body?: string;
	max_retries?: number;
	scheduled_at?: Date;
}

/**
 * Update Email Queue Request
 *
 * Request payload for updating an email in the queue
 *
 * @interface UpdateEmailQueueRequest
 * @property {'pending' | 'sent' | 'failed'} [status] - Update the email status
 * @property {number} [retry_count] - Update the retry count
 * @property {string} [last_error] - Update the last error message
 * @property {Date} [sent_at] - Set the sent timestamp
 */
export interface UpdateEmailQueueRequest {
	status?: 'pending' | 'sent' | 'failed';
	retry_count?: number;
	last_error?: string;
	sent_at?: Date;
}

/**
 * Result Type
 *
 * Standard result type for database operations.
 * Either returns data on success or error message on failure.
 *
 * @typedef {Object} Result
 * @template T - The type of data returned on success
 * @property {T} data - The returned data (only present on success)
 * @property {string} error - Error message (only present on failure)
 */
export type Result<T> =
	| { data: T; error?: undefined }
	| { error: string; data?: undefined };

/**
 * Email Queue Model
 *
 * Database operations for managing email queue entries
 */
export const emailQueueModel = {
	/**
	 * Create a new email in the queue
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {CreateEmailQueueRequest} request - Email details to create
	 * @returns {Promise<Result<EmailQueueItem>>} Created email record or error
	 *
	 * @example
	 * const result = await emailQueueModel.createEmail(db, {
	 *   recipient_email: 'user@example.com',
	 *   subject: 'Welcome',
	 *   body: 'Welcome to our service'
	 * });
	 */
	async createEmail(db: any, request: CreateEmailQueueRequest): Promise<Result<EmailQueueItem>> {
		try {
			const [result] = await db
				.insert(emailQueue)
				.values({
					recipient_email: request.recipient_email,
					subject: request.subject,
					body: request.body,
					html_body: request.html_body,
					max_retries: request.max_retries ?? 3,
					scheduled_at: request.scheduled_at,
				})
				.returning();

			return { data: result };
		} catch (error) {
			return { error: `Failed to create email: ${error}` };
		}
	},

	/**
	 * Get an email by ID
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {number} id - Email ID to retrieve
	 * @returns {Promise<Result<EmailQueueItem>>} Email record or error if not found
	 */
	async getEmail(db: any, id: number): Promise<Result<EmailQueueItem>> {
		try {
			const result = await db.select().from(emailQueue).where(eq(emailQueue.id, id));

			if (result.length === 0) {
				return { error: 'Email not found' };
			}

			return { data: result[0] };
		} catch (error) {
			return { error: `Failed to fetch email: ${error}` };
		}
	},

	/**
	 * List emails with optional filtering
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {Object} [filters] - Optional filter criteria
	 * @param {'pending' | 'sent' | 'failed'} [filters.status] - Filter by email status
	 * @param {number} [filters.limit] - Maximum number of results to return
	 * @param {number} [filters.offset] - Number of results to skip
	 * @param {'asc' | 'desc'} [filters.order='desc'] - Sort order by creation date
	 * @returns {Promise<Result<EmailQueueItem[]>>} List of email records or error
	 */
	async listEmails(
		db: any,
		filters?: {
			status?: 'pending' | 'sent' | 'failed';
			limit?: number;
			offset?: number;
			order?: 'asc' | 'desc';
		}
	): Promise<Result<EmailQueueItem[]>> {
		try {
			let query = db.select().from(emailQueue);

			if (filters?.status) {
				query = query.where(eq(emailQueue.status, filters.status));
			}

			query = query.orderBy(
				filters?.order === 'asc' ? asc(emailQueue.created_at) : desc(emailQueue.created_at)
			);

			if (filters?.limit) {
				query = query.limit(filters.limit);
			}

			if (filters?.offset) {
				query = query.offset(filters.offset);
			}

			const results = await query;
			return { data: results };
		} catch (error) {
			return { error: `Failed to list emails: ${error}` };
		}
	},

	/**
	 * Update an email record
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {number} id - Email ID to update
	 * @param {UpdateEmailQueueRequest} updates - Fields to update
	 * @returns {Promise<Result<EmailQueueItem>>} Updated email record or error
	 */
	async updateEmail(db: any, id: number, updates: UpdateEmailQueueRequest): Promise<Result<EmailQueueItem>> {
		try {
			const [result] = await db
				.update(emailQueue)
				.set({
					...updates,
					updated_at: new Date(),
				})
				.where(eq(emailQueue.id, id))
				.returning();

			if (!result) {
				return { error: 'Email not found' };
			}

			return { data: result };
		} catch (error) {
			return { error: `Failed to update email: ${error}` };
		}
	},

	/**
	 * Delete an email from the queue
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {number} id - Email ID to delete
	 * @returns {Promise<Result<{id: number}>>} Deleted email ID or error
	 */
	async deleteEmail(db: any, id: number): Promise<Result<{ id: number }>> {
		try {
			const result = await db.delete(emailQueue).where(eq(emailQueue.id, id)).returning();

			if (result.length === 0) {
				return { error: 'Email not found' };
			}

			return { data: { id: result[0].id } };
		} catch (error) {
			return { error: `Failed to delete email: ${error}` };
		}
	},

	/**
	 * Get pending emails for processing
	 *
	 * Returns emails with status='pending' ordered by oldest first (FIFO).
	 * Used by external email services to fetch emails to send.
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {number} [limit=10] - Maximum number of emails to return
	 * @returns {Promise<Result<EmailQueueItem[]>>} Array of pending emails or error
	 */
	async getPendingEmails(db: any, limit: number = 10): Promise<Result<EmailQueueItem[]>> {
		try {
			const now = new Date();
			const results = await db
				.select()
				.from(emailQueue)
				.where(eq(emailQueue.status, 'pending'))
				.orderBy(asc(emailQueue.created_at))
				.limit(limit);

			return { data: results };
		} catch (error) {
			return { error: `Failed to fetch pending emails: ${error}` };
		}
	},

	/**
	 * Get failed emails for retry processing
	 *
	 * Returns emails with status='failed' ordered by most recent failures first.
	 * Used by external services to identify emails that need to be retried.
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {number} [limit=10] - Maximum number of emails to return
	 * @returns {Promise<Result<EmailQueueItem[]>>} Array of failed emails or error
	 */
	async getFailedEmails(db: any, limit: number = 10): Promise<Result<EmailQueueItem[]>> {
		try {
			const results = await db
				.select()
				.from(emailQueue)
				.where(eq(emailQueue.status, 'failed'))
				.orderBy(desc(emailQueue.updated_at))
				.limit(limit);

			return { data: results };
		} catch (error) {
			return { error: `Failed to fetch failed emails: ${error}` };
		}
	},
};
