/**
 * Email Queue Service
 *
 * High-level service for managing email queue operations.
 * Designed for external email providers to integrate with the queue system.
 * Provides utilities for fetching pending emails, marking as sent/failed, and retry management.
 *
 * @module emailQueue/service
 */

import { emailQueueModel } from './model';

/**
 * Email Queue Service
 *
 * Provides high-level operations for email queue management.
 * This service is designed to be called by external email providers
 * to fetch, process, and update email queue items.
 *
 * @namespace emailQueueService
 */
export const emailQueueService = {
	/**
	 * Get the next batch of pending emails to process
	 *
	 * Fetches emails that are ready to be sent (status='pending').
	 * Emails are returned in FIFO order (oldest first).
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {number} [limit=10] - Maximum number of emails to fetch
	 * @returns {Promise<Result<EmailQueueItem[]>>} Array of pending emails or error
	 *
	 * @example
	 * const result = await emailQueueService.getNextBatch(db, 5);
	 * if (result.data) {
	 *   // Process emails...
	 * }
	 */
	async getNextBatch(db: any, limit: number = 10) {
		return emailQueueModel.getPendingEmails(db, limit);
	},

	/**
	 * Mark an email as successfully sent
	 *
	 * Updates the email status to 'sent' and records the current timestamp.
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {number} emailId - ID of the email to mark as sent
	 * @returns {Promise<Result<EmailQueueItem>>} Updated email record or error
	 *
	 * @example
	 * const result = await emailQueueService.markAsSent(db, 123);
	 */
	async markAsSent(db: any, emailId: number) {
		return emailQueueModel.updateEmail(db, emailId, {
			status: 'sent',
			sent_at: new Date(),
		});
	},

	/**
	 * Mark an email as failed with error information
	 *
	 * Updates the email with failure details. If the retry count hasn't
	 * exceeded max_retries, the email is kept as 'pending' for later retry.
	 * Otherwise, it's marked as 'failed'.
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {number} emailId - ID of the email that failed
	 * @param {string} errorMessage - Error message to store
	 * @returns {Promise<Result<EmailQueueItem>>} Updated email record or error
	 *
	 * @example
	 * const result = await emailQueueService.markAsFailed(db, 123, 'SMTP connection timeout');
	 */
	async markAsFailed(db: any, emailId: number, errorMessage: string) {
		// Get current email to check retry count
		const emailResult = await emailQueueModel.getEmail(db, emailId);

		if (emailResult.error) {
			return emailResult;
		}

		const email = emailResult.data!;
		const newRetryCount = email.retry_count + 1;
		const shouldRetry = newRetryCount < email.max_retries;

		// If we've exceeded max retries, mark as failed
		// Otherwise, keep as pending for next attempt
		return emailQueueModel.updateEmail(db, emailId, {
			status: shouldRetry ? 'pending' : 'failed',
			retry_count: newRetryCount,
			last_error: errorMessage,
		});
	},

	/**
	 * Get detailed statistics about the email queue
	 *
	 * Returns counts of pending, sent, and failed emails.
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @returns {Promise<Object>} Queue statistics
	 * @returns {number} returns.pending_count - Number of pending emails
	 * @returns {number} returns.sent_count - Number of sent emails
	 * @returns {number} returns.failed_count - Number of failed emails
	 *
	 * @example
	 * const stats = await emailQueueService.getQueueStats(db);
	 * console.log(`${stats.pending_count} emails waiting to be sent`);
	 */
	async getQueueStats(db: any) {
		const pendingResult = await emailQueueModel.listEmails(db, {
			status: 'pending',
			limit: 1,
		});
		const sentResult = await emailQueueModel.listEmails(db, {
			status: 'sent',
			limit: 1,
		});
		const failedResult = await emailQueueModel.listEmails(db, {
			status: 'failed',
			limit: 1,
		});

		return {
			pending_count: pendingResult.data?.length ?? 0,
			sent_count: sentResult.data?.length ?? 0,
			failed_count: failedResult.data?.length ?? 0,
		};
	},

	/**
	 * Retry a failed email by resetting it to pending status
	 *
	 * Resets the retry count to 0 and clears the error message.
	 * The email will be picked up by the next batch fetch.
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @param {number} emailId - ID of the email to retry
	 * @returns {Promise<Result<EmailQueueItem>>} Updated email record or error
	 *
	 * @example
	 * const result = await emailQueueService.retryFailedEmail(db, 123);
	 */
	async retryFailedEmail(db: any, emailId: number) {
		return emailQueueModel.updateEmail(db, emailId, {
			status: 'pending',
			retry_count: 0,
			last_error: null,
		});
	},

	/**
	 * Retry all failed emails that haven't exceeded their max retry count
	 *
	 * Resets all recoverable failed emails back to pending status.
	 * Only resets emails that have retry_count < max_retries.
	 *
	 * @async
	 * @param {any} db - Database instance
	 * @returns {Promise<Result<EmailQueueItem[]>>} Array of retried email records or error
	 *
	 * @example
	 * const result = await emailQueueService.retryAllFailedEmails(db);
	 * if (result.data) {
	 *   console.log(`Retrying ${result.data.length} emails`);
	 * }
	 */
	async retryAllFailedEmails(db: any) {
		const failedResult = await emailQueueModel.getFailedEmails(db, 1000);

		if (failedResult.error) {
			return failedResult;
		}

		const retriedEmails = [];
		for (const email of failedResult.data!) {
			if (email.retry_count < email.max_retries) {
				const result = await emailQueueModel.updateEmail(db, email.id, {
					status: 'pending',
					retry_count: 0,
					last_error: null,
				});
				if (result.data) {
					retriedEmails.push(result.data);
				}
			}
		}

		return { data: retriedEmails };
	},
};
