import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { users, usersToClubs, clubs } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export interface User {
	id: number;
	token: string;
	first_name?: string;
	last_name?: string;
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
				first_name: data.first_name,
				last_name: data.last_name,
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
				token: data.token,
				first_name: data.first_name,
				last_name: data.last_name,
				permission: data.permission,
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

export const getUserWithClubs = async (
	db: NeonHttpDatabase<Record<string, never>>,
	userId: number
): Promise<{ user: User; clubs: any[] } | null> => {
	try {
		const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
		if (user.length === 0) {
			return null;
		}

		const userClubs = await db
			.select()
			.from(usersToClubs)
			.where(eq(usersToClubs.user_id, userId));

		return {
			user: user[0],
			clubs: userClubs,
		};
	} catch (error) {
		console.error('Error fetching user with clubs:', error);
		return null;
	}
};

export const getAllUsersWithClubs = async (
	db: NeonHttpDatabase<Record<string, never>>
): Promise<Result> => {
	try {
		const allUsers = await db.select().from(users);

		const usersWithClubs = await Promise.all(
			allUsers.map(async (user) => {
				const userClubs = await db
					.select()
					.from(usersToClubs)
					.where(eq(usersToClubs.user_id, user.id));

				return {
					...user,
					clubs: userClubs,
				};
			})
		);

		return { data: usersWithClubs };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}
};

export const assignClubToUser = async (
	db: NeonHttpDatabase<Record<string, never>>,
	userId: string,
	clubId: number,
	rolePermission?: number
): Promise<Result> => {
	if (!userId) {
		return {
			error: 'Missing user ID',
		};
	}

	if (!clubId) {
		return {
			error: 'Missing club ID',
		};
	}

	try {
		const parsedUserId = parseInt(userId, 10);

		// Check if user exists
		const user = await db.select().from(users).where(eq(users.id, parsedUserId)).limit(1);
		if (user.length === 0) {
			return {
				error: 'User not found',
			};
		}

		// Check if club exists
		const club = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
		if (club.length === 0) {
			return {
				error: 'Club not found',
			};
		}

		// If rolePermission is provided, update user's permission (replaces any existing role)
		if (rolePermission) {
			await db
				.update(users)
				.set({
					permission: rolePermission,
				})
				.where(eq(users.id, parsedUserId));
		}

		// Try to insert the assignment
		const results = await db
			.insert(usersToClubs)
			.values({
				user_id: parsedUserId,
				club_id: clubId,
			})
			.onConflictDoNothing()
			.returning();

		// If no rows returned, the assignment already existed
		if (results.length === 0) {
			return {
				data: [
					{
						user_id: parsedUserId,
						club_id: clubId,
					},
				],
			};
		}

		return { data: results };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}
};

export const removeClubFromUser = async (
	db: NeonHttpDatabase<Record<string, never>>,
	userId: string,
	clubId: string
): Promise<Result> => {
	if (!userId) {
		return {
			error: 'Missing user ID',
		};
	}

	if (!clubId) {
		return {
			error: 'Missing club ID',
		};
	}

	try {
		const parsedUserId = parseInt(userId, 10);
		const parsedClubId = parseInt(clubId, 10);

		// Check if user exists
		const user = await db.select().from(users).where(eq(users.id, parsedUserId)).limit(1);
		if (user.length === 0) {
			return {
				error: 'User not found',
			};
		}

		// Check if club exists
		const club = await db.select().from(clubs).where(eq(clubs.id, parsedClubId)).limit(1);
		if (club.length === 0) {
			return {
				error: 'Club not found',
			};
		}

		// Delete the assignment
		const results = await db
			.delete(usersToClubs)
			.where(
				and(
					eq(usersToClubs.user_id, parsedUserId),
					eq(usersToClubs.club_id, parsedClubId)
				)
			)
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}
};
