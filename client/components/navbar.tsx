'use client';

import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export function Navbar() {
  return (
    <nav className="bg-gray-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold">
              Locomotive House
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link
                href="/"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
              >
                Appointments
              </Link>
              <SignedIn>
                <Link
                  href="/appointments/create"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition"
                >
                  Create Appointment
                </Link>
              </SignedIn>
            </div>
          </div>
          <div className="flex items-center">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-sm font-medium transition">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </div>
    </nav>
  );
}
