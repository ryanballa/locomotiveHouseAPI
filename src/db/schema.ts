// db/schema.ts
import { pgTable, serial, integer, text, boolean, primaryKey, date, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const addresses = pgTable('addresses', {
	id: serial('id').primaryKey().notNull(),
	number: integer('number').default(3).notNull(),
	description: text('description').notNull(),
	in_use: boolean('in_use').notNull(),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
	club_id: integer('club_id')
		.notNull()
		.references(() => clubs.id),
});
export const consists = pgTable('consists', {
	id: serial('id').primaryKey().notNull(),
	number: integer('number').default(3).notNull(),
	in_use: boolean('in_use').notNull(),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
});
export const clubs = pgTable('clubs', {
	id: serial('id').primaryKey().notNull(),
	name: text('name').notNull(),
	description: text('description'),
	hero_image: text('hero_image'),
});
export const users = pgTable('users', {
	id: serial('id').primaryKey().notNull(),
	token: text('token').notNull(),
	first_name: text('first_name'),
	last_name: text('last_name'),
	permission: integer('permission_id').references(() => permissions.id),
});
export const ClubsRelations = relations(clubs, ({ many }) => ({
	usersToClubs: many(usersToClubs),
}));
export const usersToClubs = pgTable(
	'users_to_clubs',
	{
		user_id: integer('user_id')
			.notNull()
			.references(() => users.id),
		club_id: integer('club_id')
			.notNull()
			.references(() => clubs.id),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.user_id, t.club_id] }),
	})
);
export const usersToClubsRelations = relations(usersToClubs, ({ one }) => ({
	club: one(clubs, {
		fields: [usersToClubs.club_id],
		references: [clubs.id],
	}),
	user: one(users, {
		fields: [usersToClubs.user_id],
		references: [users.id],
	}),
}));
export const permissions = pgTable('permissions', {
	id: serial('id').primaryKey().notNull(),
	title: text('title').notNull(),
});

export const appointments = pgTable('appointments', {
	id: serial('id').primaryKey().notNull(),
	schedule: timestamp('schedule', { mode: 'date' }),
	duration: integer('number').default(3).notNull(),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
	scheduled_session_id: integer('scheduled_session_id').references(() => scheduledSessions.id),
});

export const inviteTokens = pgTable('invite_tokens', {
	id: serial('id').primaryKey().notNull(),
	token: text('token').notNull().unique(),
	club_id: integer('club_id')
		.notNull()
		.references(() => clubs.id),
	role_permission: integer('role_permission').references(() => permissions.id),
	expires_at: timestamp('expires_at', { mode: 'date' }).notNull(),
	created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const towers = pgTable('towers', {
	id: serial('id').primaryKey().notNull(),
	name: text('name').notNull(),
	club_id: integer('club_id')
		.notNull()
		.references(() => clubs.id),
	description: text('description'),
	owner_id: integer('owner_id')
		.notNull()
		.references(() => users.id),
	created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
	updated_at: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const towerReports = pgTable('tower_reports', {
	id: serial('id').primaryKey().notNull(),
	tower_id: integer('tower_id')
		.notNull()
		.references(() => towers.id),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
	description: text('description'),
	report_at: timestamp('report_at', { mode: 'date' }).notNull().defaultNow(),
	created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
	updated_at: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const issues = pgTable('issues', {
	id: serial('id').primaryKey().notNull(),
	tower_id: integer('tower_id')
		.notNull()
		.references(() => towers.id),
	user_id: integer('user_id')
		.notNull()
		.references(() => users.id),
	title: text('title').notNull(),
	type: text('type').notNull(),
	status: text('status').notNull(),
	description: text('description'),
	created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
	updated_at: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const emailQueue = pgTable('email_queue', {
	id: serial('id').primaryKey().notNull(),
	recipient_email: text('recipient_email').notNull(),
	subject: text('subject').notNull(),
	body: text('body').notNull(),
	html_body: text('html_body'),
	status: text('status').notNull().default('pending'), // pending, sent, failed
	retry_count: integer('retry_count').notNull().default(0),
	max_retries: integer('max_retries').notNull().default(3),
	last_error: text('last_error'),
	scheduled_at: timestamp('scheduled_at', { mode: 'date' }),
	sent_at: timestamp('sent_at', { mode: 'date' }),
	created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
	updated_at: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const scheduledSessions = pgTable('scheduled_sessions', {
	id: serial('id').primaryKey().notNull(),
	schedule: timestamp('schedule', { mode: 'date' }).notNull(),
	club_id: integer('club_id')
		.notNull()
		.references(() => clubs.id),
	description: text('description'),
});

export const notices = pgTable('notices', {
	id: serial('id').primaryKey().notNull(),
	club_id: integer('club_id')
		.notNull()
		.references(() => clubs.id),
	description: text('description').notNull(),
	type: text('type'),
	is_public: boolean('is_public'),
	expires_at: timestamp('expires_at', { mode: 'date' }),
	created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
	updated_at: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});

export const applications = pgTable('applications', {
	id: serial('id').primaryKey().notNull(),
	club_id: integer('club_id')
		.notNull()
		.references(() => clubs.id),
	name: text('name'),
	email: text('email'),
	birthday: timestamp('schedule', { mode: 'date' }),
	occupation: text('occupation'),
	interested_scale: text('interested_scale'),
	special_interests: text('special_interests'),
	has_home_layout: boolean('has_home_layout'),
	collection_size: text('collection_size'),
	has_other_model_railroad_associations: boolean('has_other_model_railroad_associations'),
	will_agree_to_club_rules: boolean('will_agree_to_club_rules'),
	created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
	updated_at: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
});
