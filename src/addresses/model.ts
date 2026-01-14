import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { addresses, usersToClubs } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export interface Address {
	id: number;
	number: number;
	description?: string;
	in_use: boolean;
	user_id: number;
	club_id: number;
}

export interface Result {
	error?: string | any;
	data?: Address[] | null;
}

/**
 * Check if an address number can be used within a club.
 * Duplicate address numbers are allowed, but only one can be in_use at a time.
 * @param db - Database instance
 * @param number - Address number to check
 * @param clubId - Club ID to check within
 * @param inUse - Whether the new/updated address will be in_use
 * @param addressId - Optional address ID to exclude (for updates)
 * @returns Result with error if another in_use address with same number exists, null if valid
 */
const checkIfAddressNumberInUseInClub = async (
	db: NeonHttpDatabase<Record<string, never>>,
	number: number,
	clubId: number,
	inUse: boolean,
	addressId: number | null = null
): Promise<Result> => {
	// Only check for conflicts if the new/updated address will be in_use
	if (!inUse) {
		return {
			error: null,
			data: [],
		};
	}

	try {
		const query = db
			.select()
			.from(addresses)
			.where(and(eq(addresses.number, number), eq(addresses.club_id, clubId), eq(addresses.in_use, true)));

		const existing = await query;

		// Filter out the current address if updating
		const conflictingAddresses = addressId
			? existing.filter((addr) => parseInt(addr.id, 10) !== parseInt(addressId, 10))
			: existing;

		if (conflictingAddresses.length > 0) {
			return {
				error: `Address number ${number} is already in use in this club`,
			};
		}
	} catch (error) {
		return {
			error,
		};
	}

	return {
		error: null,
		data: [],
	};
};

export const selectAddress = async (db: NeonHttpDatabase<Record<string, never>>, id: number): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};
	try {
		const addressesResp = await db.select().from(addresses).where(eq(addresses.number, id));
		return { data: addressesResp };
	} catch (error) {
		return {
			error,
		};
	}
};

export const createAddress = async (db: NeonHttpDatabase<Record<string, never>>, data: Address): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (!data.number || data.in_use === undefined || !data.user_id || !data.club_id) {
		return {
			error: 'Missing required field. Required: number, in_use, user_id, club_id',
		};
	}

	// Check that only one address with this number can be in_use at a time
	const existingFlag = await checkIfAddressNumberInUseInClub(db, data.number, data.club_id, data.in_use, null);

	if (existingFlag.error) {
		return {
			error: existingFlag.error,
		};
	}

	try {
		const results = await db
			.insert(addresses)
			.values({
				number: data.number,
				description: data.description,
				in_use: data.in_use,
				user_id: data.user_id,
				club_id: data.club_id,
			})
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const updateAddress = async (db: NeonHttpDatabase<Record<string, never>>, id: string, data: Address): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing body',
		};

	if (!id)
		return {
			error: 'Missing ID',
		};

	if (!data.number || data.in_use === undefined || !data.user_id || !data.club_id) {
		return {
			error: 'Missing required field. Required: number, in_use, user_id, club_id',
		};
	}

	// Check that only one address with this number can be in_use at a time (excluding current address)
	const existingFlag = await checkIfAddressNumberInUseInClub(
		db,
		data.number,
		data.club_id,
		data.in_use,
		parseInt(id, 10)
	);

	if (existingFlag.error) {
		return {
			error: existingFlag.error,
		};
	}

	try {
		const results = await db
			.update(addresses)
			.set({
				number: data.number,
				description: data.description,
				in_use: data.in_use,
				user_id: data.user_id,
				club_id: data.club_id,
			})
			.where(eq(addresses.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const deleteAddress = async (db: NeonHttpDatabase<Record<string, never>>, id: string): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.delete(addresses)
			.where(eq(addresses.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const getAddressesByClubId = async (db: NeonHttpDatabase<Record<string, never>>, clubId: string): Promise<Result> => {
	if (!clubId)
		return {
			error: 'Missing club ID',
		};

	try {
		const results = await db.select().from(addresses).where(eq(addresses.club_id, parseInt(clubId, 10)));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
