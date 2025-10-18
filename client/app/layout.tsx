import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { UserProvider } from "@/components/user-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Locomotive House Appointments",
  description: "Schedule your appointments with Locomotive House",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">
          <UserProvider>
            {children}
          </UserProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
