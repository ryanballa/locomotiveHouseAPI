import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';

/**
 * Initializes and returns a Drizzle ORM database instance.
 *
 * Creates a connection to a Neon PostgreSQL database using the DATABASE_URL
 * from environment variables. The returned instance can be used to perform
 * database queries using Drizzle ORM's type-safe query builder.
 *
 * @param c - Hono context object containing environment variables (c.env.DATABASE_URL)
 * @returns A Drizzle ORM database instance configured for Neon HTTP client
 *
 * @example
 * ```typescript
 * import { dbInitalizer } from './utils/db';
 *
 * app.get('/api/users', (c) => {
 *   const db = dbInitalizer({ c });
 *   const users = await db.select().from(users);
 *   return c.json({ users });
 * });
 * ```
 *
 * @remarks
 * - Requires DATABASE_URL to be set in environment variables
 * - Creates a new connection each time it's called (suitable for serverless functions)
 * - The returned instance uses Neon's HTTP client for serverless compatibility
 *
 * @throws May throw if DATABASE_URL is not set in environment variables
 */
export const dbInitalizer = function ({ c }: any) {
	const sql = neon(c.env.DATABASE_URL);
	return drizzle(sql);
};
