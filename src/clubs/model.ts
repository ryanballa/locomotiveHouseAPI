import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { clubs } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface Club {
	id: number;
	name: string;
}

export interface Result {
	error?: string | any;
	data?: Club[] | null;
}
export const createClub = async (db: NeonHttpDatabase<Record<string, never>>, data: Club): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (!data.name) {
		return {
			error: 'Missing required field',
		};
	}

	try {
		const results = await db
			.insert(clubs)
			.values({
				name: data.name,
			})
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
