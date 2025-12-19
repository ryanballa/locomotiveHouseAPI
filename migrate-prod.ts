// migrate-prod.ts
import { config } from 'dotenv';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
config({ path: '.dev.vars' });
const databaseUrl = drizzle(postgres(`${process.env.DATABASE_URL_PROD}`, { ssl: 'require', max: 1 }));
const main = async () => {
	try {
		await migrate(databaseUrl, { migrationsFolder: 'drizzle' });
		console.log('Production migration complete');
	} catch (error) {
		console.log(error);
	}
	process.exit(0);
};
main();
