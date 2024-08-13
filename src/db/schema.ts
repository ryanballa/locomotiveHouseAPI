// db/schema.ts
import { pgTable, serial, integer, text, boolean } from 'drizzle-orm/pg-core';
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
