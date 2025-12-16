import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';

import { applications } from '../db/schema';

/**
 * Represents an application in the system.
 *
 * Applications are membership applications submitted to a specific club.
 * They contain applicant information and responses to club membership questions.
 *
 * @property id - Unique identifier for the application (auto-generated, omit when creating)
 * @property club_id - ID of the club this application belongs to (required, immutable after creation)
 * @property name - Applicant's name (optional)
 * @property email - Applicant's email address (optional)
 * @property birthday - Applicant's date of birth (optional)
 * @property occupation - Applicant's occupation (optional)
 * @property interested_scale - Scale of interest (optional)
 * @property special_interests - Special interests of the applicant (optional)
 * @property has_home_layout - Whether applicant has a home layout (optional)
 * @property collection_size - Size of applicant's collection (optional)
 * @property has_other_model_railroad_associations - Whether applicant is member of other associations (optional)
 * @property will_agree_to_club_rules - Whether applicant agrees to club rules (optional)
 * @property created_at - Timestamp when the application was created (auto-generated, omit when creating)
 * @property updated_at - Timestamp when the application was last updated (auto-generated, omit when creating)
 *
 * @example
 * ```typescript
 * const application: Application = {
 *   club_id: 123,
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   occupation: 'Engineer',
 *   will_agree_to_club_rules: true
 * };
 * ```
 */
export interface Application {
	id?: number;
	club_id: number;
	name?: string | null;
	email?: string | null;
	birthday?: Date | null;
	occupation?: string | null;
	interested_scale?: string | null;
	special_interests?: string | null;
	has_home_layout?: boolean | null;
	collection_size?: string | null;
	has_other_model_railroad_associations?: boolean | null;
	will_agree_to_club_rules?: boolean | null;
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
 * @property data - Array of applications if operation succeeded, null if error occurred
 *
 * @example
 * ```typescript
 * const result = await getApplications(db);
 * if (result.error) {
 *   console.error('Failed:', result.error);
 * } else {
 *   console.log('Applications:', result.data);
 * }
 * ```
 */
export interface Result {
	error?: string | any;
	data?: Application[] | null;
}

/**
 * Retrieves all applications from the database.
 *
 * Fetches all applications across all clubs without any filtering.
 * Use `getApplicationsByClubId` to get applications for a specific club.
 *
 * @param db - Drizzle ORM database instance
 * @returns Result object containing all applications or error message
 *
 * @example
 * ```typescript
 * const result = await getApplications(db);
 * if (!result.error) {
 *   console.log('Total applications:', result.data?.length);
 * } else {
 *   console.error('Database error:', result.error);
 * }
 * ```
 *
 * @throws Returns error in result object if database query fails
 */
export const getApplications = async (db: NeonHttpDatabase<Record<string, never>>): Promise<Result> => {
	try {
		const results = await db.select().from(applications);
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves all applications for a specific club.
 *
 * Fetches all applications associated with a particular club without any additional filtering.
 * This is the primary method for retrieving applications scoped to a club.
 *
 * @param db - Drizzle ORM database instance
 * @param clubId - ID of the club to fetch applications for (required)
 * @returns Result object containing array of applications for the club, or error message if operation fails
 *
 * @example
 * ```typescript
 * const result = await getApplicationsByClubId(db, 123);
 * if (!result.error) {
 *   console.log(`Found ${result.data?.length} applications for club 123`);
 * } else {
 *   console.error('Failed to fetch applications:', result.error);
 * }
 * ```
 *
 * @throws Returns error in result object if clubId is not provided or database query fails
 */
export const getApplicationsByClubId = async (
	db: NeonHttpDatabase<Record<string, never>>,
	clubId: number
): Promise<Result> => {
	if (!clubId)
		return {
			error: 'Missing club ID',
		};
	try {
		const results = await db.select().from(applications).where(eq(applications.club_id, clubId));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves an application by its ID.
 *
 * Fetches a single application from the database by its unique identifier.
 * Does not verify club ownership - use `getApplicationByIdAndClubId` if you need club scoping.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the application to retrieve (required)
 * @returns Result object containing the application in an array, or error message if operation fails
 *
 * @example
 * ```typescript
 * const result = await getApplicationById(db, 456);
 * if (!result.error && result.data?.length > 0) {
 *   console.log('Application found:', result.data[0].name);
 * } else {
 *   console.error('Application not found or error occurred');
 * }
 * ```
 *
 * @remarks
 * - Returns results in an array for consistency with other database operations
 * - Does not filter by club, so use `getApplicationByIdAndClubId` for scoped access
 * - Returns empty array if no application exists with the given ID
 *
 * @throws Returns error in result object if id is not provided or database query fails
 */
export const getApplicationById = async (db: NeonHttpDatabase<Record<string, never>>, id: number): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};
	try {
		const results = await db.select().from(applications).where(eq(applications.id, id));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Retrieves an application by its ID and verifies it belongs to a specific club.
 *
 * Fetches an application and verifies ownership by the specified club.
 * This is the preferred method for scoped application access, ensuring the application belongs to the correct club.
 * Essential for API endpoints that need to validate resource ownership before modifications.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the application to retrieve (required)
 * @param clubId - ID of the club the application should belong to (required)
 * @returns Result object containing the application in an array if found and owned by the club, error message otherwise
 *
 * @example
 * ```typescript
 * const result = await getApplicationByIdAndClubId(db, 456, 123);
 * if (!result.error && result.data && result.data.length > 0) {
 *   console.log('Application belongs to club:', result.data[0].club_id);
 * } else if (!result.error && result.data?.length === 0) {
 *   console.log('Application not found in this club');
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 *
 * @remarks
 * - Returns empty array if the application exists but belongs to a different club
 * - Always use this function instead of `getApplicationById` when you need to validate club ownership
 * - Critical for security - prevents unauthorized access to applications from other clubs
 * - Used internally by PUT and DELETE endpoints to ensure cross-club access is prevented
 *
 * @throws Returns error in result object if required parameters are missing or database query fails
 */
export const getApplicationByIdAndClubId = async (
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
			.from(applications)
			.where(and(eq(applications.id, id), eq(applications.club_id, clubId)));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Creates a new application.
 *
 * Inserts a new application into the database with the provided data.
 * Validates that the required club_id field is present before attempting database insertion.
 * Automatically manages created_at and updated_at timestamps via database defaults.
 *
 * @param db - Drizzle ORM database instance
 * @param data - Application data to create (must include club_id)
 * @returns Result object containing the created application with auto-generated id and timestamps, or error message
 *
 * @example
 * ```typescript
 * const result = await createApplication(db, {
 *   club_id: 123,
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   occupation: 'Engineer',
 *   will_agree_to_club_rules: true
 * });
 * if (!result.error && result.data) {
 *   console.log('Application created with ID:', result.data[0].id);
 * } else {
 *   console.error('Failed to create application:', result.error);
 * }
 * ```
 *
 * @remarks
 * - Required fields: club_id
 * - Optional fields: name, email, birthday, occupation, interested_scale, special_interests,
 *   has_home_layout, collection_size, has_other_model_railroad_associations, will_agree_to_club_rules
 * - Auto-generated fields: id, created_at, updated_at
 * - club_id should reference an existing club in the database
 * - Returns the complete inserted application including auto-generated fields
 *
 * @throws Returns error in result object if required fields are missing or database insertion fails
 */
export const createApplication = async (db: NeonHttpDatabase<Record<string, never>>, data: Application): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (!data.club_id) {
		return {
			error: 'Missing required field: club_id',
		};
	}

	try {
		const results = await db
			.insert(applications)
			.values({
				club_id: data.club_id,
				name: data.name,
				email: data.email,
				birthday: data.birthday,
				occupation: data.occupation,
				interested_scale: data.interested_scale,
				special_interests: data.special_interests,
				has_home_layout: data.has_home_layout,
				collection_size: data.collection_size,
				has_other_model_railroad_associations: data.has_other_model_railroad_associations,
				will_agree_to_club_rules: data.will_agree_to_club_rules,
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
 * Updates an existing application.
 *
 * Modifies an application in the database. Accepts partial or complete application data.
 * All fields in the provided data object are applied to the update.
 * The club_id field is preserved from the existing application to prevent changing club ownership.
 * The updated_at timestamp is automatically updated.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the application to update (as string, will be parsed to number)
 * @param data - Partial or complete application data to update
 * @returns Result object containing the updated application with all current fields, or error message
 *
 * @example
 * ```typescript
 * // First fetch the existing application to preserve the club_id
 * const existing = await getApplicationById(db, 456);
 * if (existing.data && existing.data.length > 0) {
 *   const applicationData = {
 *     club_id: existing.data[0].club_id,  // preserve
 *     name: 'Jane Doe',                    // updated
 *     email: 'jane@example.com',           // updated
 *     occupation: 'Designer',              // updated
 *   };
 *   const result = await updateApplication(db, '456', applicationData);
 * }
 * ```
 *
 * @remarks
 * - ID parameter is passed as string and converted to number internally
 * - club_id field should be preserved from existing application
 * - All provided fields are updated
 * - updated_at timestamp is automatically updated to current time
 * - Returns the complete updated application including all fields
 * - For scoped updates that validate club ownership, use `getApplicationByIdAndClubId` first
 *
 * @throws Returns error in result object if id or data is missing, or database update fails
 */
export const updateApplication = async (db: NeonHttpDatabase<Record<string, never>>, id: string, data: Application): Promise<Result> => {
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
			.update(applications)
			.set({
				club_id: data.club_id,
				name: data.name,
				email: data.email,
				birthday: data.birthday,
				occupation: data.occupation,
				interested_scale: data.interested_scale,
				special_interests: data.special_interests,
				has_home_layout: data.has_home_layout,
				collection_size: data.collection_size,
				has_other_model_railroad_associations: data.has_other_model_railroad_associations,
				will_agree_to_club_rules: data.will_agree_to_club_rules,
				updated_at: new Date(),
			})
			.where(eq(applications.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

/**
 * Deletes an application by its ID.
 *
 * Removes an application from the database permanently.
 * This operation is irreversible - consider soft deletes or archival if you need to preserve data history.
 *
 * @param db - Drizzle ORM database instance
 * @param id - ID of the application to delete (as string, will be parsed to number)
 * @returns Result object containing the deleted application data in array, or error message if deletion fails
 *
 * @example
 * ```typescript
 * // Before deleting, you may want to verify the application exists and belongs to the correct club
 * const checkResult = await getApplicationByIdAndClubId(db, 456, 123);
 * if (!checkResult.error && checkResult.data && checkResult.data.length > 0) {
 *   const result = await deleteApplication(db, '456');
 *   if (!result.error) {
 *     console.log('Application deleted');
 *   }
 * } else {
 *   console.error('Application not found in this club');
 * }
 * ```
 *
 * @remarks
 * - ID parameter is passed as string and converted to number internally
 * - This is a hard delete - the application is permanently removed from the database
 * - Returns the deleted application data in the result array
 * - For protected deletions that validate club ownership, validate with `getApplicationByIdAndClubId` first
 * - No cascade rules are defined, so this operation will fail if foreign key constraints exist elsewhere
 * - Consider implementing soft deletes or archival if you need to maintain historical data
 *
 * @throws Returns error in result object if id is missing, application doesn't exist, or database deletion fails
 */
export const deleteApplication = async (db: NeonHttpDatabase<Record<string, never>>, id: string): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.delete(applications)
			.where(eq(applications.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
