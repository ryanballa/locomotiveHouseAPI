import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { scheduledSessions, clubs } from '../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

/**
 * Represents a scheduled session in the database
 * @interface ScheduledSession
 * @property {number} id - Unique identifier for the scheduled session
 * @property {Date} schedule - The date and time when the session is scheduled
 * @property {number} club_id - The ID of the club that owns this scheduled session
 * @property {string} [description] - Optional description of the scheduled session
 */
export interface ScheduledSession {
	id: number;
	schedule: Date;
	club_id: number;
	description?: string | null;
}

/**
 * Generic result type for database operations
 * @interface Result
 * @property {string | any} [error] - Error message if operation failed
 * @property {ScheduledSession[] | null} [data] - Data returned from successful operation
 */
export interface Result {
	error?: string | any;
	data?: ScheduledSession[] | null;
}

/**
 * Creates a new scheduled session in the database
 * @async
 * @function createScheduledSession
 * @param {NeonHttpDatabase<Record<string, never>>} db - Database instance
 * @param {ScheduledSession} data - The scheduled session data to create
 * @returns {Promise<Result>} Result object containing the created scheduled session or error
 * @throws Returns error if required fields are missing or database operation fails
 * @example
 * const result = await createScheduledSession(db, {
 *   id: 0,
 *   schedule: new Date('2024-12-20'),
 *   club_id: 1
 * });
 */
export const createScheduledSession = async (
	db: NeonHttpDatabase<Record<string, never>>,
	data: ScheduledSession
): Promise<Result> => {
	if (!data) {
		return {
			error: 'Missing data',
		};
	}

	if (!data.schedule || !data.club_id) {
		return {
			error: 'Missing required fields: schedule and club_id are required',
		};
	}

	try {
		// Verify club exists
		const clubExists = await db
			.select()
			.from(clubs)
			.where(eq(clubs.id, data.club_id));

		if (clubExists.length === 0) {
			return {
				error: 'Club not found',
			};
		}

		const values: any = {
			schedule: new Date(data.schedule),
			club_id: data.club_id,
		};

		if (data.description) {
			values.description = data.description;
		}

		const results = await db
			.insert(scheduledSessions)
			.values(values)
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves a scheduled session by ID
 * @async
 * @function getScheduledSessionById
 * @param {NeonHttpDatabase<Record<string, never>>} db - Database instance
 * @param {string} id - The ID of the scheduled session to retrieve
 * @returns {Promise<Result>} Result object containing the scheduled session or error
 * @throws Returns error if ID is missing or database operation fails
 * @example
 * const result = await getScheduledSessionById(db, '1');
 */
export const getScheduledSessionById = async (
	db: NeonHttpDatabase<Record<string, never>>,
	id: string
): Promise<Result> => {
	if (!id) {
		return {
			error: 'Missing ID',
		};
	}

	try {
		const results = await db
			.select()
			.from(scheduledSessions)
			.where(eq(scheduledSessions.id, parseInt(id, 10)));

		return { data: results.length > 0 ? results : null };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves all scheduled sessions for a specific club
 * @async
 * @function getScheduledSessionsByClubId
 * @param {NeonHttpDatabase<Record<string, never>>} db - Database instance
 * @param {string | number} clubId - The ID of the club
 * @returns {Promise<Result>} Result object containing array of scheduled sessions or error
 * @throws Returns error if club ID is missing or database operation fails
 * @example
 * const result = await getScheduledSessionsByClubId(db, '1');
 */
export const getScheduledSessionsByClubId = async (
	db: NeonHttpDatabase<Record<string, never>>,
	clubId: string | number
): Promise<Result> => {
	if (!clubId) {
		return {
			error: 'Missing club ID',
		};
	}

	try {
		const results = await db
			.select()
			.from(scheduledSessions)
			.where(eq(scheduledSessions.club_id, parseInt(clubId.toString(), 10)));

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves scheduled sessions within a date range for a specific club
 * @async
 * @function getScheduledSessionsByDateRange
 * @param {NeonHttpDatabase<Record<string, never>>} db - Database instance
 * @param {string | number} clubId - The ID of the club
 * @param {Date} startDate - The start date (inclusive)
 * @param {Date} endDate - The end date (inclusive)
 * @returns {Promise<Result>} Result object containing filtered scheduled sessions or error
 * @throws Returns error if required parameters are missing or database operation fails
 * @example
 * const result = await getScheduledSessionsByDateRange(db, '1', new Date('2024-01-01'), new Date('2024-12-31'));
 */
export const getScheduledSessionsByDateRange = async (
	db: NeonHttpDatabase<Record<string, never>>,
	clubId: string | number,
	startDate: Date,
	endDate: Date
): Promise<Result> => {
	if (!clubId) {
		return {
			error: 'Missing club ID',
		};
	}

	if (!startDate || !endDate) {
		return {
			error: 'Missing date range: both startDate and endDate are required',
		};
	}

	try {
		const results = await db
			.select()
			.from(scheduledSessions)
			.where(
				and(
					eq(scheduledSessions.club_id, parseInt(clubId.toString(), 10)),
					gte(scheduledSessions.schedule, startDate),
					lte(scheduledSessions.schedule, endDate)
				)
			);

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Updates a scheduled session
 * @async
 * @function updateScheduledSession
 * @param {NeonHttpDatabase<Record<string, never>>} db - Database instance
 * @param {string} id - The ID of the scheduled session to update
 * @param {Partial<ScheduledSession>} data - The fields to update
 * @returns {Promise<Result>} Result object containing the updated scheduled session or error
 * @throws Returns error if ID is missing, session doesn't exist, or database operation fails
 * @example
 * const result = await updateScheduledSession(db, '1', {
 *   schedule: new Date('2024-12-25')
 * });
 */
export const updateScheduledSession = async (
	db: NeonHttpDatabase<Record<string, never>>,
	id: string,
	data: Partial<ScheduledSession>
): Promise<Result> => {
	if (!data) {
		return {
			error: 'Missing data',
		};
	}

	if (!id) {
		return {
			error: 'Missing ID',
		};
	}

	try {
		// Verify session exists
		const sessionExists = await db
			.select()
			.from(scheduledSessions)
			.where(eq(scheduledSessions.id, parseInt(id, 10)));

		if (sessionExists.length === 0) {
			return {
				error: 'Scheduled session not found',
			};
		}

		// If club_id is being updated, verify the new club exists
		if (data.club_id) {
			const clubExists = await db
				.select()
				.from(clubs)
				.where(eq(clubs.id, data.club_id));

			if (clubExists.length === 0) {
				return {
					error: 'Club not found',
				};
			}
		}

		const updateData: any = {};
		if (data.schedule) updateData.schedule = new Date(data.schedule);
		if (data.club_id) updateData.club_id = data.club_id;
		if (data.description !== undefined) updateData.description = data.description;

		const results = await db
			.update(scheduledSessions)
			.set(updateData)
			.where(eq(scheduledSessions.id, parseInt(id, 10)))
			.returning();

		return { data: results };
	} catch (error) {
		console.error('updateScheduledSession model - error:', error);
		return {
			error,
		};
	}
};

/**
 * Deletes a scheduled session by ID
 * @async
 * @function deleteScheduledSession
 * @param {NeonHttpDatabase<Record<string, never>>} db - Database instance
 * @param {string} id - The ID of the scheduled session to delete
 * @returns {Promise<Result>} Result object containing the deleted scheduled session or error
 * @throws Returns error if ID is missing or database operation fails
 * @example
 * const result = await deleteScheduledSession(db, '1');
 */
export const deleteScheduledSession = async (
	db: NeonHttpDatabase<Record<string, never>>,
	id: string
): Promise<Result> => {
	if (!id) {
		return {
			error: 'Missing ID',
		};
	}

	try {
		const results = await db
			.delete(scheduledSessions)
			.where(eq(scheduledSessions.id, parseInt(id, 10)))
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Deletes all scheduled sessions for a specific club
 * @async
 * @function deleteScheduledSessionsByClubId
 * @param {NeonHttpDatabase<Record<string, never>>} db - Database instance
 * @param {string | number} clubId - The ID of the club
 * @returns {Promise<Result>} Result object containing deleted sessions or error
 * @throws Returns error if club ID is missing or database operation fails
 * @example
 * const result = await deleteScheduledSessionsByClubId(db, '1');
 */
export const deleteScheduledSessionsByClubId = async (
	db: NeonHttpDatabase<Record<string, never>>,
	clubId: string | number
): Promise<Result> => {
	if (!clubId) {
		return {
			error: 'Missing club ID',
		};
	}

	try {
		const results = await db
			.delete(scheduledSessions)
			.where(eq(scheduledSessions.club_id, parseInt(clubId.toString(), 10)))
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
