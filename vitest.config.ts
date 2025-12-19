import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineWorkersConfig({
	build: {
		sourcemap: 'hidden', // Source map generation must be turned on ("hidden", true, etc.)
	},
	plugins: [
		// Put the Sentry Vite plugin after all other plugins
		sentryVitePlugin({
			org: 'locomotivehouse',
			project: 'locomotivehouse',
			authToken: process.env.SENTRY_AUTH_TOKEN,
			sourcemaps: {
				// As you're enabling client source maps, you probably want to delete them after they're uploaded to Sentry.
				// Set the appropriate glob pattern for your output folder - some glob examples below:
				filesToDeleteAfterUpload: ['./**/*.map', '.*/**/public/**/*.map', './dist/**/client/**/*.map'],
			},
		}),
	],
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
			},
		},
	},
});
