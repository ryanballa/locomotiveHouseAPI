import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq, and, inArray, gte, lt } from 'drizzle-orm';

import { towerReports, towers } from '../db/schema';

/**
 * Represents a tower report in the system.
 *
 * Tower reports document observations, maintenance records, or activities at a specific tower.
 * They are created by users to track important events and information about towers.
 *
 * @property id - Unique identifier for the report (auto-generated, omit when creating)
 * @property tower_id - ID of the tower this report is about (required, immutable after creation)
 * @property user_id - ID of the user who created the report (required, immutable after creation)
 * @property description - Details about the report (optional, descriptive text)
 * @property report_at - When the reported event occurred (required, defaults to now)
 * @property created_at - Timestamp when the report was created (auto-generated, omit when creating)
 * @property updated_at - Timestamp when the report was last updated (auto-generated, omit when creating)
 *
 * @example
 * ```typescript
 * const report: TowerReport = {
 *   tower_id: 123,
 *   user_id: 456,
 *   description: 'Bell maintenance completed',
 *   report_at: new Date()
 * };
 * ```
 */
export interface TowerReport {
	id?: number;
	tower_id: number;
	user_id: number;
	description?: string | null;
	report_at?: Date;
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
 * @property data - Array of tower reports if operation succeeded, null if error occurred
 *
 * @example
 * ```typescript
 * const result = await getTowerReports(db);
 * if (result.error) {
 *   console.error('Failed:', result.error);
 * } else {
 *   console.log('Reports:', result.data);
 * }
 * ```
 */
export interface Result {
	error?: string | any;
	data?: TowerReport[] | null;
}

/**
 * Retrieves all tower reports from the database.
 *
 * Fetches all tower reports across all towers without any filtering.
 * Use `getTowerReportsByTowerId` to get reports for a specific tower.
 *
 * @param db - Drizzle ORM database instance
 * @returns Result object containing all tower reports or error message
 *
 * @example
 * ```typescript
 * const result = await getTowerReports(db);
 * if (!result.error) {
 *   console.log('Total reports:', result.data?.length);
 * } else {
 *   console.error('Database error:', result.error);
 * }
 * ```
 *
 * @throws Returns error in result object if database query fails
 */
export const getTowerReports = async (db: NeonHttpDatabase<Record<string, never>>): Promise<Result> => {
	try {
		const results = await db.select().from(towerReports);
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves all reports for a specific tower.
 *
 * Fetches all reports associated with a particular tower without any additional filtering.
 * This is the primary method for retrieving reports scoped to a tower.
 *
 * @param db - Drizzle ORM database instance
 * @param towerId - ID of the tower to fetch reports for (required)
 * @returns Result object containing array of reports for the tower, or error message if operation fails
 *
 * @example
 * ```typescript
 * const result = await getTowerReportsByTowerId(db, 123);
 * if (!result.error) {
 *   console.log(`Found ${result.data?.length} reports in tower 123`);
 * } else {
 *   console.error('Failed to fetch reports:', result.error);
 * }
 * ```
 *
 * @throws Returns error in result object if towerId is not provided or database query fails
 */
export const getTowerReportsByTowerId = async (
	db: NeonHttpDatabase<Record<string, never>>,
	towerId: number
): Promise<Result> => {
	if (!towerId)
		return {
			error: 'Missing tower ID',
		};
	try {
		const results = await db.select().from(towerReports).where(eq(towerReports.tower_id, towerId));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves all tower reports for a specific club.
 *
 * Fetches all reports associated with towers in a particular club.
 * This is useful for getting a comprehensive view of all tower activity within a club.
 *
 * @param db - Drizzle ORM database instance
 * @param clubId - ID of the club to fetch reports for (required)
 * @returns Result object containing array of reports for all towers in the club, or error message if operation fails
 *
 * @example
 * ```typescript
 * const result = await getTowerReportsByClubId(db, 789);
 * if (!result.error) {
 *   console.log(`Found ${result.data?.length} reports in club 789`);
 * } else {
 *   console.error('Failed to fetch reports:', result.error);
 * }
 * ```
 *
 * @remarks
 * - Joins towers and tower_reports tables to find reports for all towers in the club
 * - Returns empty array if club has no towers or no reports
 * - Useful for club-level reporting and analytics
 *
 * @throws Returns error in result object if clubId is not provided or database query fails
 */
export const getTowerReportsByClubId = async (
	db: NeonHttpDatabase<Record<string, never>>,
	clubId: number
): Promise<Result> => {
	if (!clubId)
		return {
			error: 'Missing club ID',
		};
	try {
		// First, get all tower IDs for the club
		const clubTowers = await db.select({ id: towers.id }).from(towers).where(eq(towers.club_id, clubId));

		if (clubTowers.length === 0) {
			return { data: [] };
		}

		const towerIds = clubTowers.map(t => t.id);

		// Then get all reports for those towers
		const results = await db.select().from(towerReports).where(inArray(towerReports.tower_id, towerIds));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves all tower reports for a specific club with optional year and month filtering.
 *
 * Fetches all reports associated with towers in a particular club.
 * Supports optional filtering by year and/or month to retrieve reports from specific time periods.
 *
 * @param db - Drizzle ORM database instance
 * @param clubId - ID of the club to fetch reports for (required)
 * @param filters - Optional filters object with year and/or month
 * @param filters.year - Optional year to filter by (e.g., 2024)
 * @param filters.month - Optional month to filter by (1-12, only used if year is also provided)
 * @returns Result object containing array of reports for all towers in the club, or error message if operation fails
 *
 * @example
 * ```typescript
 * // Get all reports for club 789
 * const allReports = await getTowerReportsByClubIdWithDateFilter(db, 789);
 *
 * // Get all reports for club 789 in 2024
 * const yearReports = await getTowerReportsByClubIdWithDateFilter(db, 789, { year: 2024 });
 *
 * // Get all reports for club 789 in November 2024
 * const monthReports = await getTowerReportsByClubIdWithDateFilter(db, 789, { year: 2024, month: 11 });
 * ```
 *
 * @remarks
 * - Joins towers and tower_reports tables to find reports for all towers in the club
 * - Returns empty array if club has no towers or no reports
 * - Year filter is inclusive: includes all reports from January 1st to December 31st of that year
 * - Month filter only applies if year is also provided
 * - Month should be 1-12 (January-December)
 * - Useful for club-level reporting and analytics with time-based filtering
 *
 * @throws Returns error in result object if clubId is not provided or database query fails
 */
export const getTowerReportsByClubIdWithDateFilter = async (
	db: NeonHttpDatabase<Record<string, never>>,
	clubId: number,
	filters?: {
		year?: number;
		month?: number;
	}
): Promise<Result> => {
	if (!clubId)
		return {
			error: 'Missing club ID',
		};
	try {
		// First, get all tower IDs for the club
		const clubTowers = await db.select({ id: towers.id }).from(towers).where(eq(towers.club_id, clubId));

		if (clubTowers.length === 0) {
			return { data: [] };
		}

		const towerIds = clubTowers.map(t => t.id);

		// Build the base where condition with tower filter
		let whereCondition = inArray(towerReports.tower_id, towerIds);

		// Add date filters if provided
		if (filters?.year) {
			const year = filters.year;
			const startDate = new Date(year, 0, 1); // January 1st of the year

			if (filters.month && filters.month >= 1 && filters.month <= 12) {
				// Filter by specific month
				const month = filters.month - 1; // JavaScript months are 0-indexed
				const nextMonthStart = new Date(year, month + 1, 1);
				whereCondition = and(
					whereCondition,
					and(
						gte(towerReports.report_at, new Date(year, month, 1)),
						lt(towerReports.report_at, nextMonthStart)
					)
				);
			} else {
				// Filter by year only
				const nextYearStart = new Date(year + 1, 0, 1); // January 1st of next year
				whereCondition = and(
					whereCondition,
					and(gte(towerReports.report_at, startDate), lt(towerReports.report_at, nextYearStart))
				);
			}
		}

		const results = await db.select().from(towerReports).where(whereCondition);
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves a tower report by its ID.
 *
 * Fetches a single tower report from the database by its unique identifier.
 * Does not verify tower ownership - use `getTowerReportByIdAndTowerId` if you need tower scoping.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the report to retrieve (required)
 * @returns Result object containing the report in an array, or error message if operation fails
 *
 * @example
 * ```typescript
 * const result = await getTowerReportById(db, 456);
 * if (!result.error && result.data?.length > 0) {
 *   console.log('Report found:', result.data[0].description);
 * } else {
 *   console.error('Report not found or error occurred');
 * }
 * ```
 *
 * @remarks
 * - Returns results in an array for consistency with other database operations
 * - Does not filter by tower, so use `getTowerReportByIdAndTowerId` for scoped access
 * - Returns empty array if no report exists with the given ID
 *
 * @throws Returns error in result object if id is not provided or database query fails
 */
export const getTowerReportById = async (db: NeonHttpDatabase<Record<string, never>>, id: number): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};
	try {
		const results = await db.select().from(towerReports).where(eq(towerReports.id, id));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves a tower report by its ID and verifies it belongs to a specific tower.
 *
 * Fetches a report and verifies ownership by the specified tower.
 * This is the preferred method for scoped report access, ensuring the report belongs to the correct tower.
 * Essential for API endpoints that need to validate resource ownership before modifications.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the report to retrieve (required)
 * @param towerId - ID of the tower the report should belong to (required)
 * @returns Result object containing the report in an array if found and owned by the tower, error message otherwise
 *
 * @example
 * ```typescript
 * const result = await getTowerReportByIdAndTowerId(db, 456, 123);
 * if (!result.error && result.data && result.data.length > 0) {
 *   console.log('Report belongs to tower:', result.data[0].tower_id);
 * } else if (!result.error && result.data?.length === 0) {
 *   console.log('Report not found in this tower');
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 *
 * @remarks
 * - Returns empty array if the report exists but belongs to a different tower
 * - Always use this function instead of `getTowerReportById` when you need to validate tower ownership
 * - Critical for security - prevents unauthorized access to reports from other towers
 * - Used internally by PUT and DELETE endpoints to ensure cross-tower access is prevented
 *
 * @throws Returns error in result object if required parameters are missing or database query fails
 */
export const getTowerReportByIdAndTowerId = async (
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
			.from(towerReports)
			.where(and(eq(towerReports.id, id), eq(towerReports.tower_id, towerId)));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Creates a new tower report.
 *
 * Inserts a new report into the database with the provided data.
 * Validates that all required fields are present before attempting database insertion.
 * Automatically manages created_at and updated_at timestamps via database defaults.
 *
 * @param db - Drizzle ORM database instance
 * @param data - Tower report data to create (must include tower_id, user_id)
 * @returns Result object containing the created report with auto-generated id and timestamps, or error message
 *
 * @example
 * ```typescript
 * const result = await createTowerReport(db, {
 *   tower_id: 123,
 *   user_id: 456,
 *   description: 'Annual bell inspection completed'
 * });
 * if (!result.error && result.data) {
 *   console.log('Report created with ID:', result.data[0].id);
 * } else {
 *   console.error('Failed to create report:', result.error);
 * }
 * ```
 *
 * @remarks
 * - Required fields: tower_id, user_id
 * - Optional fields: description, report_at
 * - Auto-generated fields: id, created_at, updated_at
 * - tower_id should reference an existing tower in the database
 * - user_id should reference an existing user in the database
 * - Returns the complete inserted report including auto-generated fields
 *
 * @throws Returns error in result object if required fields are missing or database insertion fails
 */
export const createTowerReport = async (
	db: NeonHttpDatabase<Record<string, never>>,
	data: TowerReport
): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (data.tower_id === undefined || data.tower_id === null || data.user_id === undefined || data.user_id === null) {
		return {
			error: `Missing required field. Required: tower_id, user_id. Received: tower_id=${data.tower_id}, user_id=${data.user_id}`,
		};
	}

	try {
		// Ensure tower_id and user_id are numbers
		const towerId = typeof data.tower_id === 'string' ? parseInt(data.tower_id, 10) : data.tower_id;
		const userId = typeof data.user_id === 'string' ? parseInt(data.user_id, 10) : data.user_id;

		const results = await db
			.insert(towerReports)
			.values({
				tower_id: towerId,
				user_id: userId,
				description: data.description,
				report_at: data.report_at,
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
 * Updates an existing tower report.
 *
 * Modifies a report in the database. Accepts partial or complete report data.
 * All fields in the provided data object are applied to the update - ensure you preserve
 * immutable fields (tower_id, user_id) by including their original values.
 * The updated_at timestamp is NOT automatically updated by this function - updates must be managed by the caller if needed.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the report to update (as string, will be parsed to number)
 * @param data - Partial or complete report data to update (provide all fields, not just changed ones)
 * @returns Result object containing the updated report with all current fields, or error message
 *
 * @example
 * ```typescript
 * // First fetch the existing report to preserve immutable fields
 * const existing = await getTowerReportById(db, 456);
 * if (existing.data && existing.data.length > 0) {
 *   const reportData = {
 *     tower_id: existing.data[0].tower_id,  // preserve
 *     user_id: existing.data[0].user_id,    // preserve
 *     description: 'Updated inspection notes'
 *   };
 *   const result = await updateTowerReport(db, '456', reportData);
 * }
 * ```
 *
 * @remarks
 * - ID parameter is passed as string and converted to number internally
 * - Immutable fields (tower_id, user_id) should be preserved and re-submitted
 * - All provided fields are updated - partial updates should explicitly include unchanged values
 * - updated_at timestamp is NOT automatically updated (would require database trigger or explicit handling)
 * - Returns the complete updated report including all fields
 * - For scoped updates that validate tower ownership, use `getTowerReportByIdAndTowerId` first
 *
 * @throws Returns error in result object if id or data is missing, or database update fails
 */
export const updateTowerReport = async (
	db: NeonHttpDatabase<Record<string, never>>,
	id: string,
	data: TowerReport
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
			.update(towerReports)
			.set({
				tower_id: data.tower_id,
				user_id: data.user_id,
				description: data.description,
				report_at: data.report_at,
				updated_at: new Date(),
			})
			.where(eq(towerReports.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Deletes a tower report by its ID.
 *
 * Removes a report from the database permanently.
 * This operation is irreversible - consider soft deletes or archival if you need to preserve data history.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the report to delete (as string, will be parsed to number)
 * @returns Result object containing the deleted report data in array, or error message if deletion fails
 *
 * @example
 * ```typescript
 * // Before deleting, you may want to verify the report exists and belongs to the correct tower
 * const checkResult = await getTowerReportByIdAndTowerId(db, 456, 123);
 * if (!checkResult.error && checkResult.data && checkResult.data.length > 0) {
 *   const result = await deleteTowerReport(db, '456');
 *   if (!result.error) {
 *     console.log('Report deleted');
 *   }
 * } else {
 *   console.error('Report not found in this tower');
 * }
 * ```
 *
 * @remarks
 * - ID parameter is passed as string and converted to number internally
 * - This is a hard delete - the report is permanently removed from the database
 * - Returns the deleted report data in the result array
 * - For protected deletions that validate tower ownership, validate with `getTowerReportByIdAndTowerId` first
 * - No cascade rules are defined, so this operation will fail if foreign key constraints exist elsewhere
 * - Consider implementing soft deletes or archival if you need to maintain historical data
 *
 * @throws Returns error in result object if id is missing, report doesn't exist, or database deletion fails
 */
export const deleteTowerReport = async (
	db: NeonHttpDatabase<Record<string, never>>,
	id: string
): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.delete(towerReports)
			.where(eq(towerReports.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
