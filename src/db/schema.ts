// db/schema.ts
import { pgTable, serial, integer, text, boolean } from 'drizzle-orm/pg-core';
export const addresses = pgTable('addresses', {
	id: serial('id').primaryKey().notNull(),
	number: integer('int1').default(3).notNull(),
	description: text('description').notNull(),
	in_use: boolean('boolean').notNull(),
	owner: text('owner').notNull(),
});
