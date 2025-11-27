/**
 * Client Usage Example
 *
 * This file shows how to use the Hono client with type-safe API calls.
 * Copy this pattern to your frontend application.
 *
 * Installation:
 * npm install hono
 */

import { hc } from 'hono/client';
import type { AppType } from '../index';

// Create the client
// Replace the URL with your actual API URL
const client = hc<AppType>('https://api.example.com');

// Example usage:
export async function exampleUsage() {
	// Get all appointments - fully typed!
	const appointmentsResponse = await client.api.appointments.$get();
	const data = await appointmentsResponse.json();
	// data.result is fully typed as Appointment[]

	// Create an appointment - request and response are typed
	const createResponse = await client.api.appointments.$post({
		json: {
			schedule: new Date(),
			duration: 60,
			user_id: 1,
			scheduled_session_id: 5,
		},
	});

	// Get club addresses - typed!
	const addressesResponse = await client.api.clubs[':id'].addresses.$get({
		param: { id: '1' },
	});

	// Delete an appointment - typed request path params
	const deleteResponse = await client.api.appointments[':id'].$delete({
		param: { id: '1' },
	});
}

/**
 * Benefits of using Hono client:
 * - Autocomplete for all routes
 * - Compile-time type checking for request/response bodies
 * - No code generation needed - types come from your server code
 * - TypeScript catches mistakes before runtime
 *
 * For browser/React usage, see:
 * https://hono.dev/docs/guides/rpc
 */
