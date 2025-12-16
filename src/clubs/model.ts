import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { clubs, usersToClubs } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface Club {
	id: number;
	name: string;
	description?: string | null;
	hero_image?: string | null;
}

export interface ClubAssignment {
	user_id: number;
	club_id: string;
}

export interface Result {
	error?: string | any;
	data?: Club[] | null;
}

export interface AssignmentResult {
	error?: string | any;
	data?: ClubAssignment[] | null;
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
				description: data.description,
				hero_image: data.hero_image,
			})
			.returning();

		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const updateClub = async (db: NeonHttpDatabase<Record<string, never>>, id: string, data: Club): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing body',
		};

	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.update(clubs)
			.set({
				name: data.name,
				description: data.description,
				hero_image: data.hero_image,
			})
			.where(eq(clubs.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const createClubAssignments = async (db: NeonHttpDatabase<Record<string, never>>, data: AssignmentResult): Promise<Result> => {
	if (!data.user_id || !data.club_id) {
		return {
			error: 'Missing body',
		};
	}
	try {
		const results = await db
			.insert(usersToClubs)
			.values({
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
