import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';

import { issues } from '../db/schema';

/**
 * Represents an issue in the system.
 *
 * Issues are problems, bugs, or maintenance items associated with a specific tower.
 * They are created and tracked by users to document and manage tower-related problems.
 *
 * @property id - Unique identifier for the issue (auto-generated, omit when creating)
 * @property tower_id - ID of the tower this issue belongs to (required, immutable after creation)
 * @property user_id - ID of the user who created/reported the issue (required, immutable after creation)
 * @property title - Title/name of the issue (required, max 255 chars)
 * @property type - Category or type of the issue (required, e.g., 'maintenance', 'bug', 'feature', 'urgent')
 * @property description - Detailed description of the issue (optional, up to 2000 chars recommended)
 * @property created_at - Timestamp when the issue was created (auto-generated, omit when creating)
 * @property updated_at - Timestamp when the issue was last updated (auto-generated, omit when creating)
 *
 * @example
 * ```typescript
 * const issue: Issue = {
 *   tower_id: 123,
 *   user_id: 456,
 *   title: 'Broken escalator',
 *   type: 'maintenance',
 *   description: 'Escalator on floor 3 not operational'
 * };
 * ```
 */
export interface Issue {
	id?: number;
	tower_id: number;
	user_id: number;
	title: string;
	type: string;
	status?: string | null;
	description?: string | null;
	created_at?: Date;
	updated_at?: Date;
}

/**
 * Standard result object for database operations.
 *
 * All database operations return this interface to provide consistent
 * error handling and data access patterns.
 *
 * @property error - Error message if operation failed (contains error details)
 * @property data - Array of issues if operation succeeded, null if error occurred
 *
 * @example
 * ```typescript
 * const result = await getIssues(db);
 * if (result.error) {
 *   console.error('Failed:', result.error);
 * } else {
 *   console.log('Issues:', result.data);
 * }
 * ```
 */
export interface Result {
	error?: string | any;
	data?: Issue[] | null;
}

/**
 * Retrieves all issues from the database.
 *
 * Fetches all issues across all towers without any filtering.
 * Use `getIssuesByTowerId` to get issues for a specific tower.
 *
 * @param db - Drizzle ORM database instance
 * @returns Result object containing all issues or error message
 *
 * @example
 * ```typescript
 * const result = await getIssues(db);
 * if (!result.error) {
 *   console.log('Total issues:', result.data?.length);
 * } else {
 *   console.error('Database error:', result.error);
 * }
 * ```
 *
 * @throws Returns error in result object if database query fails
 */
export const getIssues = async (db: NeonHttpDatabase<Record<string, never>>): Promise<Result> => {
	try {
		const results = await db.select().from(issues);
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves all issues for a specific tower.
 *
 * Fetches all issues associated with a particular tower without any additional filtering.
 * This is the primary method for retrieving issues scoped to a tower.
 *
 * @param db - Drizzle ORM database instance
 * @param towerId - ID of the tower to fetch issues for (required)
 * @returns Result object containing array of issues for the tower, or error message if operation fails
 *
 * @example
 * ```typescript
 * const result = await getIssuesByTowerId(db, 123);
 * if (!result.error) {
 *   console.log(`Found ${result.data?.length} issues in tower 123`);
 * } else {
 *   console.error('Failed to fetch issues:', result.error);
 * }
 * ```
 *
 * @throws Returns error in result object if towerId is not provided or database query fails
 */
export const getIssuesByTowerId = async (
	db: NeonHttpDatabase<Record<string, never>>,
	towerId: number
): Promise<Result> => {
	if (!towerId)
		return {
			error: 'Missing tower ID',
		};
	try {
		const results = await db.select().from(issues).where(eq(issues.tower_id, towerId));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves an issue by its ID.
 *
 * Fetches a single issue from the database by its unique identifier.
 * Does not verify tower ownership - use `getIssueByIdAndTowerId` if you need tower scoping.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the issue to retrieve (required)
 * @returns Result object containing the issue in an array, or error message if operation fails
 *
 * @example
 * ```typescript
 * const result = await getIssueById(db, 456);
 * if (!result.error && result.data?.length > 0) {
 *   console.log('Issue found:', result.data[0].title);
 * } else {
 *   console.error('Issue not found or error occurred');
 * }
 * ```
 *
 * @remarks
 * - Returns results in an array for consistency with other database operations
 * - Does not filter by tower, so use `getIssueByIdAndTowerId` for scoped access
 * - Returns empty array if no issue exists with the given ID
 *
 * @throws Returns error in result object if id is not provided or database query fails
 */
export const getIssueById = async (db: NeonHttpDatabase<Record<string, never>>, id: number): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};
	try {
		const results = await db.select().from(issues).where(eq(issues.id, id));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves an issue by its ID and verifies it belongs to a specific tower.
 *
 * Fetches an issue and verifies ownership by the specified tower.
 * This is the preferred method for scoped issue access, ensuring the issue belongs to the correct tower.
 * Essential for API endpoints that need to validate resource ownership before modifications.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the issue to retrieve (required)
 * @param towerId - ID of the tower the issue should belong to (required)
 * @returns Result object containing the issue in an array if found and owned by the tower, error message otherwise
 *
 * @example
 * ```typescript
 * const result = await getIssueByIdAndTowerId(db, 456, 123);
 * if (!result.error && result.data && result.data.length > 0) {
 *   console.log('Issue belongs to tower:', result.data[0].tower_id);
 * } else if (!result.error && result.data?.length === 0) {
 *   console.log('Issue not found in this tower');
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 *
 * @remarks
 * - Returns empty array if the issue exists but belongs to a different tower
 * - Always use this function instead of `getIssueById` when you need to validate tower ownership
 * - Critical for security - prevents unauthorized access to issues from other towers
 * - Used internally by PUT and DELETE endpoints to ensure cross-tower access is prevented
 *
 * @throws Returns error in result object if required parameters are missing or database query fails
 */
export const getIssueByIdAndTowerId = async (
	db: NeonHttpDatabase<Record<string, never>>,
	id: number,
	towerId: number
): Promise<Result> => {
	if (!id || !towerId)
		return {
			error: 'Missing ID or tower ID',
		};
	try {
		const results = await db
			.select()
			.from(issues)
			.where(and(eq(issues.id, id), eq(issues.tower_id, towerId)));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Creates a new issue.
 *
 * Inserts a new issue into the database with the provided data.
 * Validates that all required fields are present before attempting database insertion.
 * Automatically manages created_at and updated_at timestamps via database defaults.
 *
 * @param db - Drizzle ORM database instance
 * @param data - Issue data to create (must include tower_id, user_id, title, type)
 * @returns Result object containing the created issue with auto-generated id and timestamps, or error message
 *
 * @example
 * ```typescript
 * const result = await createIssue(db, {
 *   tower_id: 123,
 *   user_id: 456,
 *   title: 'Broken escalator',
 *   type: 'maintenance',
 *   description: 'The escalator on floor 3 is not working'
 * });
 * if (!result.error && result.data) {
 *   console.log('Issue created with ID:', result.data[0].id);
 * } else {
 *   console.error('Failed to create issue:', result.error);
 * }
 * ```
 *
 * @remarks
 * - Required fields: tower_id, user_id, title, type
 * - Optional fields: description
 * - Auto-generated fields: id, created_at, updated_at
 * - tower_id should reference an existing tower in the database
 * - user_id should reference an existing user in the database
 * - Returns the complete inserted issue including auto-generated fields
 *
 * @throws Returns error in result object if required fields are missing or database insertion fails
 */
export const createIssue = async (db: NeonHttpDatabase<Record<string, never>>, data: Issue): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (!data.tower_id || !data.user_id || !data.title || !data.type) {
		return {
			error: 'Missing required field. Required: tower_id, user_id, title, type',
		};
	}

	try {
		const results = await db
			.insert(issues)
			.values({
				tower_id: data.tower_id,
				user_id: data.user_id,
				title: data.title,
				type: data.type,
				status: data.status,
				description: data.description,
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
 * Updates an existing issue.
 *
 * Modifies an issue in the database. Accepts partial or complete issue data.
 * All fields in the provided data object are applied to the update - ensure you preserve
 * immutable fields (tower_id, user_id) by including their original values.
 * The updated_at timestamp is NOT automatically updated by this function - updates must be managed by the caller if needed.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the issue to update (as string, will be parsed to number)
 * @param data - Partial or complete issue data to update (provide all fields, not just changed ones)
 * @returns Result object containing the updated issue with all current fields, or error message
 *
 * @example
 * ```typescript
 * // First fetch the existing issue to preserve immutable fields
 * const existing = await getIssueById(db, 456);
 * if (existing.data && existing.data.length > 0) {
 *   const issueData = {
 *     tower_id: existing.data[0].tower_id,  // preserve
 *     user_id: existing.data[0].user_id,    // preserve
 *     title: 'Fixed escalator',              // updated
 *     type: 'resolved',                      // updated
 *     description: 'Issue resolved on 2024-11-09'
 *   };
 *   const result = await updateIssue(db, '456', issueData);
 * }
 * ```
 *
 * @remarks
 * - ID parameter is passed as string and converted to number internally
 * - Immutable fields (tower_id, user_id) should be preserved and re-submitted
 * - All provided fields are updated - partial updates should explicitly include unchanged values
 * - updated_at timestamp is NOT automatically updated (would require database trigger or explicit handling)
 * - Returns the complete updated issue including all fields
 * - For scoped updates that validate tower ownership, use `getIssueByIdAndTowerId` first
 *
 * @throws Returns error in result object if id or data is missing, or database update fails
 */
export const updateIssue = async (db: NeonHttpDatabase<Record<string, never>>, id: string, data: Issue): Promise<Result> => {
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
			.update(issues)
			.set({
				tower_id: data.tower_id,
				user_id: data.user_id,
				title: data.title,
				type: data.type,
				status: data.status,
				description: data.description,
				updated_at: new Date(),
			})
			.where(eq(issues.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Deletes an issue by its ID.
 *
 * Removes an issue from the database permanently.
 * This operation is irreversible - consider soft deletes or archival if you need to preserve data history.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the issue to delete (as string, will be parsed to number)
 * @returns Result object containing the deleted issue data in array, or error message if deletion fails
 *
 * @example
 * ```typescript
 * // Before deleting, you may want to verify the issue exists and belongs to the correct tower
 * const checkResult = await getIssueByIdAndTowerId(db, 456, 123);
 * if (!checkResult.error && checkResult.data && checkResult.data.length > 0) {
 *   const result = await deleteIssue(db, '456');
 *   if (!result.error) {
 *     console.log('Issue deleted');
 *   }
 * } else {
 *   console.error('Issue not found in this tower');
 * }
 * ```
 *
 * @remarks
 * - ID parameter is passed as string and converted to number internally
 * - This is a hard delete - the issue is permanently removed from the database
 * - Returns the deleted issue data in the result array
 * - For protected deletions that validate tower ownership, validate with `getIssueByIdAndTowerId` first
 * - No cascade rules are defined, so this operation will fail if foreign key constraints exist elsewhere
 * - Consider implementing soft deletes or archival if you need to maintain historical data
 *
 * @throws Returns error in result object if id is missing, issue doesn't exist, or database deletion fails
 */
export const deleteIssue = async (db: NeonHttpDatabase<Record<string, never>>, id: string): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.delete(issues)
			.where(eq(issues.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
