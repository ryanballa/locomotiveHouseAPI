import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { appointments, usersToClubs } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface Appointment {
	id: number;
	schedule: Date;
	duration: number;
	user_id: number;
	scheduled_session_id?: number | null;
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
		const values: any = {
			schedule: new Date(data.schedule),
			duration: data.duration,
			user_id: data.user_id,
		};

		if (data.scheduled_session_id) {
			values.scheduled_session_id = data.scheduled_session_id;
		}

		const results = await db
			.insert(appointments)
			.values(values)
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
		const updateData: any = {
			schedule: scheduleDate,
			duration: data.duration,
		};

		if (data.scheduled_session_id !== undefined) {
			updateData.scheduled_session_id = data.scheduled_session_id;
		}

		const results = await db
			.update(appointments)
			.set(updateData)
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
				scheduled_session_id: appointments.scheduled_session_id,
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

export const getAppointmentsByScheduledSessionId = async (db: NeonHttpDatabase<Record<string, never>>, sessionId: string): Promise<Result> => {
	if (!sessionId)
		return {
			error: 'Missing session ID',
		};

	try {
		const results = await db
			.select({
				id: appointments.id,
				schedule: appointments.schedule,
				duration: appointments.duration,
				user_id: appointments.user_id,
				scheduled_session_id: appointments.scheduled_session_id,
			})
			.from(appointments)
			.where(eq(appointments.scheduled_session_id, parseInt(sessionId, 10)));
		return { data: results };
	} catch (error) {
		return {
			error,
		};
	}
};
