import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { appointments, usersToClubs } from '../db/schema';
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

	const scheduleDate = new Date(data.schedule);

	try {
		const results = await db
			.update(appointments)
			.set({
				schedule: scheduleDate,
				duration: data.duration,
			})
			.where(eq(appointments.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		console.error('updateAppointment model - error:', error);
		return {
			error,
		};
	}
};

export const deleteAppointment = async (db: NeonHttpDatabase<Record<string, never>>, id: string): Promise<Result> => {
	if (!id)
		return {
			error: 'Missing ID',
		};

	try {
		const results = await db
			.delete(appointments)
			.where(eq(appointments.id, parseInt(id, 10)))
			.returning();
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};

export const getAppointmentsByClubId = async (db: NeonHttpDatabase<Record<string, never>>, clubId: string): Promise<Result> => {
	if (!clubId)
		return {
			error: 'Missing club ID',
		};

	try {
		const results = await db
			.select({
				id: appointments.id,
				schedule: appointments.schedule,
				duration: appointments.duration,
				user_id: appointments.user_id,
			})
			.from(appointments)
			.innerJoin(usersToClubs, eq(appointments.user_id, usersToClubs.user_id))
			.where(eq(usersToClubs.club_id, parseInt(clubId, 10)));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
