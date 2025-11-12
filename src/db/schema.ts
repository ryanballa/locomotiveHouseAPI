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
});
export const users = pgTable('users', {
	id: serial('id').primaryKey().notNull(),
	token: text('token').notNull(),
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
