import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';

import { towers } from '../db/schema';

export interface Tower {
	id?: number;
	name: string;
	club_id: number;
	owner_id?: number;
	description?: string | null;
	created_at?: Date;
	updated_at?: Date;
}

export interface Result {
	error?: string | any;
	data?: Tower[] | null;
}

export const getTowers = async (db: NeonHttpDatabase<Record<string, never>>): Promise<Result> => {
	try {
		const results = await db.select().from(towers);
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const getTowersByClubId = async (db: NeonHttpDatabase<Record<string, never>>, clubId: number): Promise<Result> => {
	if (!clubId)
		return {
			error: 'Missing club ID',
		};
	try {
		const results = await db.select().from(towers).where(eq(towers.club_id, clubId));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const getTowerById = async (db: NeonHttpDatabase<Record<string, never>>, id: number): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};
	try {
		const results = await db.select().from(towers).where(eq(towers.id, id));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const getTowerByIdAndClubId = async (db: NeonHttpDatabase<Record<string, never>>, id: number, clubId: number): Promise<Result> => {
	if (!id || !clubId)
		return {
			error: 'Missing ID or club ID',
		};
	try {
		const results = await db
			.select()
			.from(towers)
			.where(and(eq(towers.id, id), eq(towers.club_id, clubId)));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const createTower = async (db: NeonHttpDatabase<Record<string, never>>, data: Tower): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (!data.name || !data.club_id) {
		return {
			error: 'Missing required field. Required: name, club_id',
		};
	}

	try {
		const results = await db
			.insert(towers)
			.values({
				name: data.name,
				description: data.description,
				club_id: data.club_id,
				owner_id: data.owner_id,
			})
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const updateTower = async (db: NeonHttpDatabase<Record<string, never>>, id: string, data: Tower): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};
	if (!data)
		return {
			error: 'Missing data',
		};

	try {
		const results = await db
			.update(towers)
			.set({
				name: data.name,
				description: data.description,
				club_id: data.club_id,
				owner_id: data.owner_id,
				updated_at: new Date(),
			})
			.where(eq(towers.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const deleteTower = async (db: NeonHttpDatabase<Record<string, never>>, id: string): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.delete(towers)
			.where(eq(towers.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
