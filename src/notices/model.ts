import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { notices } from '../db/schema';

/**
 * Notice entity interface
 * @interface Notice
 * @property {number} id - Unique identifier for the notice
 * @property {number} club_id - Club ID associated with the notice
 * @property {string} description - Notice description/content
 * @property {string} [type] - Type/category of the notice
 * @property {Date} [expires_at] - Optional expiration date for the notice
 * @property {Date} [created_at] - Timestamp when the notice was created
 * @property {Date} [updated_at] - Timestamp when the notice was last updated
 */
export interface Notice {
	id?: number;
	club_id: number;
	description: string;
	type?: string | null;
	expires_at?: Date | null;
	created_at?: Date;
	updated_at?: Date;
}

/**
 * API response type for notice operations
 * @interface Result
 * @property {string|any} [error] - Error message if operation failed
 * @property {Notice[]|null} [data] - Array of notices or null
 */
export interface Result {
	error?: string | any;
	data?: Notice[] | null;
}

/**
 * Fetch all notices for a specific club
 *
 * @async
 * @param {NeonHttpDatabase} db - Database instance
 * @param {number} clubId - The club ID to fetch notices for
 * @returns {Promise<Result>} Result object containing notices array or error
 *
 * @example
 * const result = await getNoticesByClubId(db, 1);
 * if (!result.error) {
 *   console.log(result.data); // Array of notices
 * }
 */
export const getNoticesByClubId = async (
	db: NeonHttpDatabase<Record<string, never>>,
	clubId: number
): Promise<Result> => {
	if (!clubId)
		return {
			error: 'Missing club ID',
		};
	try {
		const results = await db.select().from(notices).where(eq(notices.club_id, clubId));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Fetch a specific notice by ID and verify it belongs to a club
 *
 * @async
 * @param {NeonHttpDatabase} db - Database instance
 * @param {number} id - The notice ID
 * @param {number} clubId - The club ID to verify ownership
 * @returns {Promise<Result>} Result object containing the notice or error
 *
 * @example
 * const result = await getNoticeByIdAndClubId(db, 5, 1);
 * if (!result.error && result.data?.length) {
 *   console.log(result.data[0]); // Single notice
 * }
 */
export const getNoticeByIdAndClubId = async (
	db: NeonHttpDatabase<Record<string, never>>,
	id: number,
	clubId: number
): Promise<Result> => {
	if (!id || !clubId)
		return {
			error: 'Missing ID or club ID',
		};
	try {
		const results = await db
			.select()
			.from(notices)
			.where(eq(notices.id, id) && eq(notices.club_id, clubId));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Create a new notice in a club
 *
 * @async
 * @param {NeonHttpDatabase} db - Database instance
 * @param {Notice} data - Notice data to create
 * @returns {Promise<Result>} Result object containing the created notice or error
 *
 * @example
 * const result = await createNotice(db, {
 *   club_id: 1,
 *   description: 'System maintenance on Sunday',
 *   type: 'maintenance',
 *   expires_at: new Date('2024-12-01')
 * });
 */
export const createNotice = async (
	db: NeonHttpDatabase<Record<string, never>>,
	data: Notice
): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (!data.club_id || !data.description) {
		return {
			error: 'Missing required fields. Required: club_id, description',
		};
	}

	try {
		const results = await db
			.insert(notices)
			.values({
				club_id: data.club_id,
				description: data.description,
				type: data.type || null,
				expires_at: data.expires_at || null,
			})
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Update an existing notice
 *
 * @async
 * @param {NeonHttpDatabase} db - Database instance
 * @param {string|number} id - The notice ID to update
 * @param {Notice} data - Updated notice data
 * @returns {Promise<Result>} Result object containing the updated notice or error
 *
 * @example
 * const result = await updateNotice(db, 5, {
 *   club_id: 1,
 *   description: 'Updated notice text',
 *   type: 'alert'
 * });
 */
export const updateNotice = async (
	db: NeonHttpDatabase<Record<string, never>>,
	id: string | number,
	data: Notice
): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};
	if (!data)
		return {
			error: 'Missing data',
		};

	try {
		const results = await db
			.update(notices)
			.set({
				club_id: data.club_id,
				description: data.description,
				type: data.type || null,
				expires_at: data.expires_at || null,
				updated_at: new Date(),
			})
			.where(eq(notices.id, parseInt(id.toString(), 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Delete a notice by ID
 *
 * @async
 * @param {NeonHttpDatabase} db - Database instance
 * @param {string|number} id - The notice ID to delete
 * @returns {Promise<Result>} Result object containing the deleted notice or error
 *
 * @example
 * const result = await deleteNotice(db, 5);
 * if (!result.error) {
 *   console.log('Notice deleted');
 * }
 */
export const deleteNotice = async (
	db: NeonHttpDatabase<Record<string, never>>,
	id: string | number
): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.delete(notices)
			.where(eq(notices.id, parseInt(id.toString(), 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
