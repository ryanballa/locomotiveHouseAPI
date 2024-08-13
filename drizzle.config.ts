// //drizzle.config.ts
// import type { Config } from 'drizzle-kit';
// export default {
// 	schema: './src/db/schema.ts',
// 	out: './drizzle',
// } satisfies Config;

import { defineConfig } from 'drizzle-kit';
export default defineConfig({
	dialect: 'postgresql',
	schema: './src/db/schema.ts',
	out: './drizzle',
});
