import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { BranchProvider } from '@/lib/branch-context';
import { ModalProvider } from '@/lib/modal-context';

export const metadata: Metadata = {
  title: 'SaaS Platform Admin & Shop Management',
  description: 'Centralized Multi-Tenant SaaS Communication and Shop Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen antialiased text-slate-900">
        <AuthProvider>
          <BranchProvider>
            <ModalProvider>
              {children}
            </ModalProvider>
          </BranchProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
