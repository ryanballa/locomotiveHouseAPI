import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { appointments } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface Appointment {
	id: number;
	schedule: Date;
	duration: number;
	user_id: number;
}

export interface Result {
	error?: string | any;
	data?: Appointment[] | null;
}

export const createAppointment = async (db: NeonHttpDatabase<Record<string, never>>, data: Appointment): Promise<Result> => {
	if (!data)
		return {
			error: 'Missing data',
		};
	if (!data.schedule || !data.duration || !data.user_id) {
		return {
			error: 'Missing required field',
		};
	}

	try {
		const results = await db
			.insert(appointments)
			.values({
				schedule: new Date(data.schedule),
				duration: data.duration,
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

export const updateAppointment = async (db: NeonHttpDatabase<Record<string, never>>, id: string, data: Appointment): Promise<Result> => {
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
			.update(appointments)
			.set({
				schedule: data.schedule,
				duration: data.duration,
			})
			.where(eq(appointments.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
