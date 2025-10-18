import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface User {
	id: number;
	token: string;
	permission: number;
}

export interface Result {
	error?: string | any;
	data?: User[] | null;
}

export const getUser = async (db: NeonHttpDatabase<Record<string, never>>, token: string): Promise<Result> => {
	if (!token)
		return {
			error: 'Missing Token',
		};

	try {
		const userResp = await db.select().from(users).where(eq(users.token, token)).limit(1);
		return { data: userResp };
	} catch (error) {
		return {
			error,
		};
	}
};

export const createUser = async (db: NeonHttpDatabase<Record<string, never>>, data: User): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};

	if (data.permission === undefined)
		return {
			error: 'Missing permission',
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
				permission: data.permission,
			})
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const updateUser = async (db: NeonHttpDatabase<Record<string, never>>, id: string, data: User): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing body',
		};

	if (!data.permission)
		return {
			error: 'Missing permission',
		};

	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.update(users)
			.set({
				permission: data.permission,
				token: data.token,
			})
			.where(eq(users.id, parseInt(id, 10)))
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
