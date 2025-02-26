import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { consists } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface Consist {
	id: number;
	number: number;
	in_use: boolean;
	owner: string;
}

export interface Result {
	error?: string | any;
	data?: Consist[] | null;
}

const checkIfConsistInUse = async (db: NeonHttpDatabase<Record<string, never>>, number: number, id: number | null): Promise<Result> => {
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
		const consistsResp = await db.select().from(consists).where(eq(consists.number, id));
		return { data: consistsResp };
	} catch (error) {
		return {
			error,
		};
	}
};

export const createConsist = async (db: NeonHttpDatabase<Record<string, never>>, data: Consist): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (!data.number || data.in_use === undefined || !data.owner) {
		return {
			error: 'Missing required field',
		};
	}
	const existingFlag = await checkIfConsistInUse(db, data.number, null);

	if (existingFlag.error) {
		return {
			error: existingFlag.error,
		};
	}

	try {
		const results = await db
			.insert(consists)
			.values({
				number: data.number,
				in_use: data.in_use,
				owner: data.owner,
			})
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const updateAddress = async (db: NeonHttpDatabase<Record<string, never>>, id: string, data: Consist): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing body',
		};

	if (!id)
		return {
			error: 'Missing ID',
		};

	const existingFlag = await checkIfConsistInUse(db, data.number, id);

	if (existingFlag.error) {
		return {
			error: existingFlag.error,
		};
	}

	try {
		const results = await db
			.update(consists)
			.set({
				number: data.number,
				in_use: data.in_use,
				owner: data.owner,
			})
			.where(eq(consists.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const deleteConsist = async (db: NeonHttpDatabase<Record<string, never>>, id: string): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.delete(consists)
			.where(eq(consists.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
