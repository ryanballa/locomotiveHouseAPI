// src/inviteTokens/model.ts
import { inviteTokens, clubs } from '../db/schema';
import { eq, gt } from 'drizzle-orm';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export interface Result<T = any> {
	error?: string | any;
	data?: T | null;
}

export interface InviteToken {
	id: number;
	token: string;
	club_id: number;
	expires_at: Date;
	created_at: Date;
}

/**
 * Generate a random invite token
 */
const generateToken = (): string => {
	return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
};

/**
 * Create a new invite token for a club
 * @param db Database instance
 * @param clubId Club ID to associate with token
 * @param expiresAt Expiration date for the token
 * @returns Result with generated token or error
 */
export const createInviteToken = async (
	db: NeonHttpDatabase,
	clubId: number,
	expiresAt: Date
): Promise<Result<InviteToken>> => {
	if (!clubId) {
		return {
			error: 'Missing club ID',
		};
	}

	if (!expiresAt) {
		return {
			error: 'Missing expiration date',
		};
	}

	// Verify club exists
	const clubResult = await db.select().from(clubs).where(eq(clubs.id, clubId));

	if (clubResult.length === 0) {
		return {
			error: 'Club not found',
		};
	}

	try {
		const token = generateToken();

		const result = await db
			.insert(inviteTokens)
			.values({
				token,
				club_id: clubId,
				expires_at: expiresAt,
				created_at: new Date(),
			})
			.returning();

		return {
			data: result[0] as InviteToken,
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : 'Failed to create invite token',
		};
	}
};

/**
 * Validate an invite token
 * @param db Database instance
 * @param token Token string to validate
 * @returns Result with token data if valid, error if invalid or expired
 */
export const validateInviteToken = async (db: NeonHttpDatabase, token: string): Promise<Result<InviteToken>> => {
	if (!token) {
		return {
			error: 'Missing invite token',
		};
	}

	try {
		const result = await db
			.select()
			.from(inviteTokens)
			.where(eq(inviteTokens.token, token));

		if (result.length === 0) {
			return {
				error: 'Invalid invite token',
			};
		}

		const inviteToken = result[0];

		// Check if token is expired
		if (new Date() > new Date(inviteToken.expires_at)) {
			return {
				error: 'Invite token has expired',
			};
		}

		return {
			data: inviteToken as InviteToken,
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : 'Failed to validate invite token',
		};
	}
};

/**
 * Get all valid invite tokens for a club
 * @param db Database instance
 * @param clubId Club ID to get tokens for
 * @returns Result with array of valid tokens
 */
export const getClubInviteTokens = async (db: NeonHttpDatabase, clubId: number): Promise<Result<InviteToken[]>> => {
	if (!clubId) {
		return {
			error: 'Missing club ID',
		};
	}

	try {
		const now = new Date();

		const result = await db
			.select()
			.from(inviteTokens)
			.where(
				clubId
					? eq(inviteTokens.club_id, clubId)
					: undefined
			);

		// Filter to only non-expired tokens
		const validTokens = result.filter((token) => new Date(token.expires_at) > now);

		return {
			data: validTokens as InviteToken[],
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : 'Failed to fetch invite tokens',
		};
	}
};

/**
 * Delete an invite token
 * @param db Database instance
 * @param token Token to delete
 * @returns Result with deletion status
 */
export const deleteInviteToken = async (db: NeonHttpDatabase, token: string): Promise<Result<boolean>> => {
	if (!token) {
		return {
			error: 'Missing invite token',
		};
	}

	try {
		const result = await db.delete(inviteTokens).where(eq(inviteTokens.token, token)).returning();

		if (result.length === 0) {
			return {
				error: 'Invite token not found',
			};
		}

		return {
			data: true,
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : 'Failed to delete invite token',
		};
	}
};
