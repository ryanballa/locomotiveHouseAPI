/**
 * Token Refresh Utility
 *
 * Handles Clerk JWT token refresh using refresh tokens.
 * Allows external services to send refresh tokens instead of storing JWT tokens.
 */

import { createClerkClient } from '@clerk/backend';

interface TokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Refresh a Clerk JWT token using a refresh token
 *
 * @param refreshToken - Clerk refresh token from external service
 * @param clerkSecretKey - Clerk secret key
 * @returns New access token, refresh token, and expiration
 */
export async function refreshAccessToken(
  refreshToken: string,
  clerkSecretKey: string
): Promise<TokenRefreshResult> {
  try {
    const clerk = createClerkClient({
      secretKey: clerkSecretKey
    });

    // Use Clerk's OAuth token refresh endpoint
    // This assumes the refresh token was created with OAuth flow
    const response = await fetch('https://clerk.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clerkSecretKey
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in || 3600
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw new Error('Failed to refresh token');
  }
}

/**
 * Validate and extract refresh token from request header
 *
 * @param authHeader - Authorization header value
 * @returns Refresh token or null
 */
export function extractRefreshToken(authHeader: string): string | null {
  if (!authHeader) return null;

  // Format: "Bearer refresh_token_value"
  const parts = authHeader.split('Bearer ');
  return parts[1] || null;
}
