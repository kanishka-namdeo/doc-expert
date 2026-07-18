'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth/client';
import { AppSidebar } from '@/components/app-sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [role, setRole] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getSession() {
      try {
        const { data } = await authClient.getSession();
        const sessionData = data as { user?: { role?: string } } | null;
        setRole(sessionData?.user?.role);
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    }
    getSession();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <div className="hidden w-60 flex-shrink-0 border-r bg-card md:block">
        <AppSidebar role={role} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="flex items-center border-b px-4 py-2 md:hidden">
          <Sheet>
            <SheetTrigger render={(props) => (
              <Button {...props} variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
              </Button>
            )} />
            <SheetContent side="left" className="w-64 p-0">
              <AppSidebar role={role} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-medium">Doc Expert</span>
        </div>

        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
