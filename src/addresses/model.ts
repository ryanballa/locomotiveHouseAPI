import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { addresses } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface Address {
	id: number;
	number: number;
	description: string;
	in_use: boolean;
	user_id: number;
}

export interface Result {
	error?: string | any;
	data?: Address[] | null;
}

const checkIfAddressInUse = async (db: NeonHttpDatabase<Record<string, never>>, number: number, id: number | null): Promise<Result> => {
	try {
		const queryExisting = await selectAddress(db, number);
		if (queryExisting?.data) {
			let inUse = queryExisting.data.filter((item) => item.in_use);
			if (id) {
				inUse = inUse.filter((item) => parseInt(item.id, 10) !== parseInt(id, 10));
			}
			if (queryExisting.data && inUse.length > 0) {
				return {
					error: 'Number in use',
				};
			}
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
	if (!data.number || !data.description || data.in_use === undefined || !data.user_id) {
		return {
			error: 'Missing required field',
		};
	}
	const existingFlag = await checkIfAddressInUse(db, data.number, null);

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

	const existingFlag = await checkIfAddressInUse(db, data.number, id);

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
