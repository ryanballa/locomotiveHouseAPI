import { auth, currentUser, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export async function GET() {
  try {
    const { userId, getToken } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the lhUserId from private metadata if it exists
    let lhUserId = user.privateMetadata?.lhUserId as number | undefined;

    // If user doesn't have lhUserId, create a new user in the database
    if (!lhUserId) {
      try {
        const token = await getToken();

        if (!token) {
          return NextResponse.json(
            { error: 'Failed to get authentication token' },
            { status: 401 }
          );
        }

        // Create user in the database using the auto-register endpoint
        const authPayload = JSON.stringify({ jwt: token });
        const response = await fetch(`${API_URL}/users/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authPayload}`,
          },
          body: JSON.stringify({
            token: userId,
            permission: null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create user');
        }

        const result = await response.json();
        lhUserId = result.id;

        // The API already updates Clerk metadata, so we don't need to do it here
      } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json(
          { error: 'Failed to create user in database' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      clerkUserId: userId,
      lhUserId: lhUserId,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    console.error('Error fetching user ID:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
