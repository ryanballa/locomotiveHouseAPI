import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface User {
	id: number;
	token: string;
}

export interface Result {
	error?: string | any;
	data?: User[] | null;
}
export const createUser = async (db: NeonHttpDatabase<Record<string, never>>, data: User): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (!data.token) {
		return {
			error: 'Missing required field',
		};
	}

	try {
		const results = await db
			.insert(users)
			.values({
				token: data.token,
			})
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const deleteUser = async (db: NeonHttpDatabase<Record<string, never>>, token: string): Promise<Result> => {
	if (!token)
		return {
			error: 'Missing Token',
		};

	try {
		const results = await db.delete(users).where(eq(users.token, token)).returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
