import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { addresses, usersToClubs } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export interface Address {
	id: number;
	number: number;
	description: string;
	in_use: boolean;
	user_id: number;
	club_id: number;
}

export interface Result {
	error?: string | any;
	data?: Address[] | null;
}

/**
 * Check if an address number is unique within a club
 * @param db - Database instance
 * @param number - Address number to check
 * @param clubId - Club ID to check uniqueness in
 * @param addressId - Optional address ID to exclude (for updates)
 * @returns Result with error if number already exists in club, null if valid
 */
const checkIfAddressNumberExistsInClub = async (
	db: NeonHttpDatabase<Record<string, never>>,
	number: number,
	clubId: number,
	addressId: number | null = null
): Promise<Result> => {
	try {
		let query = db
			.select()
			.from(addresses)
			.where(and(eq(addresses.number, number), eq(addresses.club_id, clubId)));

		const existing = await query;

		// Filter out the current address if updating
		const conflictingAddresses = addressId
			? existing.filter((addr) => parseInt(addr.id, 10) !== parseInt(addressId, 10))
			: existing;

		if (conflictingAddresses.length > 0) {
			return {
				error: `Address number ${number} already exists in this club`,
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
	if (!data.number || !data.description || data.in_use === undefined || !data.user_id || !data.club_id) {
		return {
			error: 'Missing required field. Required: number, description, in_use, user_id, club_id',
		};
	}

	// Check if address number is unique within the club
	const existingFlag = await checkIfAddressNumberExistsInClub(db, data.number, data.club_id, null);

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

	if (!data.number || !data.description || data.in_use === undefined || !data.user_id || !data.club_id) {
		return {
			error: 'Missing required field. Required: number, description, in_use, user_id, club_id',
		};
	}

	// Check if address number is unique within the club (excluding current address)
	const existingFlag = await checkIfAddressNumberExistsInClub(
		db,
		data.number,
		data.club_id,
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
