'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    // Auto-register user on sign-in if they don't have lhUserId
    const ensureUserRegistered = async () => {
      if (!isSignedIn || !user) return;

      const lhUserId = user.privateMetadata?.lhUserId;

      if (!lhUserId) {
        try {
          // Trigger auto-registration
          const response = await fetch('/api/user-id');
          const data = await response.json();

          if (data.lhUserId) {
            // Force refresh user metadata
            await user.reload();
          }
        } catch (error) {
          console.error('Failed to auto-register user:', error);
        }
      }
    };

    ensureUserRegistered();
  }, [isSignedIn, user]);

  return <>{children}</>;
}
