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

export const deleteUser = async (token: string, data: User): Promise<Result> => {
	if (!token)
		return {
			error: 'Missing Token',
		};

	try {
		const response = await fetch(`https://api.clerk.com/v1/users/${data.id}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
		});
		if (!response.ok) {
			return {
				error: {
					text: response.statusText,
					status: response.status,
				},
			};
		}
		return { data: await response.json() };
	} catch (error) {
		return {
			error,
		};
	}
};
