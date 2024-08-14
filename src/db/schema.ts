// db/schema.ts
import { pgTable, serial, integer, text, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const addresses = pgTable('addresses', {
	id: serial('id').primaryKey().notNull(),
	number: integer('int1').default(3).notNull(),
	description: text('description').notNull(),
	in_use: boolean('boolean').notNull(),
	owner: text('owner').notNull(),
});
export const consists = pgTable('consists', {
	id: serial('id').primaryKey().notNull(),
	number: integer('int1').default(3).notNull(),
	in_use: boolean('boolean').notNull(),
	owner: text('owner').notNull(),
});
export const clubs = pgTable('clubs', {
	id: serial('id').primaryKey().notNull(),
	name: text('name').notNull(),
});
export const users = pgTable('users', {
	id: serial('id').primaryKey().notNull(),
	token: text('token').notNull(),
});
export const ClubsRelations = relations(clubs, ({ many }) => ({
	usersToClubs: many(usersToClubs),
}));
export const usersToClubs = pgTable(
	'users_to_clubs',
	{
		userId: integer('user_id')
			.notNull()
			.references(() => users.id),
		clubId: integer('club_id')
			.notNull()
			.references(() => clubs.id),
	},
	(t) => ({
		pk: primaryKey({ columns: [t.userId, t.clubId] }),
	})
);
export const usersToClubsRelations = relations(usersToClubs, ({ one }) => ({
	club: one(clubs, {
		fields: [usersToClubs.clubId],
		references: [clubs.id],
	}),
	user: one(users, {
		fields: [usersToClubs.userId],
		references: [users.id],
	}),
}));
