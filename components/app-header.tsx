'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, Upload, User, LogOut, Sun, Moon, FileText, Link as LinkIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { DocumentUpload } from '@/components/document-upload';
import { DocumentList } from '@/components/document-list';
import { ConversationSidebar } from '@/components/conversation-sidebar';
import { ModelSelector } from '@/components/model-selector';
import { CollectionPicker } from '@/components/collection-picker';
import { useLogger } from '@/hooks/use-logger';

interface AppHeaderProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  showUpload: boolean;
  setShowUpload: (open: boolean) => void;
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
}

export function AppHeader({
  selectedModel,
  setSelectedModel,
  showUpload,
  setShowUpload,
  currentConversationId,
  setCurrentConversationId,
  selectedCollectionId,
  setSelectedCollectionId,
}: AppHeaderProps) {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const logger = useLogger('app-header');
  const [user, setUser] = useState<{ name: string | null; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getSession() {
      try {
        const { data } = await authClient.getSession();
        // data = { session, user } where user has name/email
        const sessionData = data as { user?: { name?: string | null; email?: string | null } } | null;
        const user = sessionData?.user;
        setUser(user ? { name: user.name ?? null, email: user.email ?? null } : null);
      } catch (err) {
        logger.error('Failed to get session', { err });
      } finally {
        setLoading(false);
      }
    }
    getSession();
  }, [logger]);

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push('/login');
    } catch (err) {
      logger.error('Logout failed', { err });
    }
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="border-b p-4">
      <div className="mx-auto flex max-w-3xl items-center gap-4">
        {/* Mobile hamburger */}
        <Sheet>
          <SheetTrigger render={(props) => (
            <Button {...props} variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          )} />
          <SheetContent side="left" className="w-64 p-0">
            <ConversationSidebar
              currentConversationId={currentConversationId}
              setCurrentConversationId={setCurrentConversationId}
            />
          </SheetContent>
        </Sheet>

        <div className="flex-1">
          <h1 className="text-xl font-semibold">Doc Expert</h1>
          <p className="text-sm text-muted-foreground">Enterprise Document Assistant</p>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector value={selectedModel} onChange={setSelectedModel} />
          <CollectionPicker
            value={selectedCollectionId}
            onChange={setSelectedCollectionId}
          />

          {/* Documents Sheet */}
          <Sheet>
            <SheetTrigger render={(props) => (
              <Button {...props} variant="ghost" size="icon" title="Documents">
                <FileText className="h-4 w-4" />
              </Button>
            )} />
            <SheetContent side="left" className="w-80">
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Uploaded Documents</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Manage your uploaded documents here.
                </p>
                <DocumentList standalone />
              </div>
            </SheetContent>
          </Sheet>

          {/* Upload Dialog */}
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger render={(props) => (
              <Button {...props} variant="ghost" size="icon" title="Upload document">
                <Upload className="h-4 w-4" />
              </Button>
            )} />
            <DialogContent className="max-w-lg">
              <DocumentUpload />
            </DialogContent>
          </Dialog>

          {/* Dark mode toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" title="User menu">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {loading ? (
                  'Loading...'
                ) : user ? (
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name || 'User'}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                ) : (
                  'Not logged in'
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings/connectors')}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Connectors
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
