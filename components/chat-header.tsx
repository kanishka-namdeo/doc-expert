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
import { Menu, Upload, User, LogOut, Sun, Moon, FileText, Clock, Keyboard } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { DocumentUpload } from '@/components/document-upload';
import { DocumentList } from '@/components/document-list';
import { ConversationSidebar } from '@/components/conversation-sidebar';
import { ModelSelector } from '@/components/model-selector';
import { CollectionPicker } from '@/components/collection-picker';
import { useLogger } from '@/hooks/use-logger';
import { NotificationBell } from '@/components/notification-bell';
import { useSessionTimeRemaining } from '@/components/session-guard';

const THIRTY_MINUTES = 30 * 60 * 1000;

function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

interface ChatHeaderProps {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  showUpload: boolean;
  setShowUpload: (open: boolean) => void;
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  selectedCollectionId: string | null;
  setSelectedCollectionId: (id: string | null) => void;
  onOpenShortcutsHelp?: () => void;
}

export function ChatHeader({
  selectedModel,
  setSelectedModel,
  showUpload,
  setShowUpload,
  currentConversationId,
  setCurrentConversationId,
  selectedCollectionId,
  setSelectedCollectionId,
  onOpenShortcutsHelp,
}: ChatHeaderProps) {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const logger = useLogger('chat-header');
  const [user, setUser] = useState<{ name: string | null; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [docFilter, setDocFilter] = useState<'owned' | 'shared-with-me' | 'shared-by-me'>('owned');
  const sessionTimeRemaining = useSessionTimeRemaining();

  useEffect(() => {
    async function getSession() {
      try {
        const { data } = await authClient.getSession();
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
    <header className="border-b p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl items-center gap-2 sm:gap-4">
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
              selectedCollectionId={selectedCollectionId}
              setSelectedCollectionId={setSelectedCollectionId}
            />
          </SheetContent>
        </Sheet>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold truncate">Doc Expert</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">Enterprise Document Assistant</p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ModelSelector value={selectedModel} onChange={setSelectedModel} />
          <CollectionPicker
            value={selectedCollectionId}
            onChange={setSelectedCollectionId}
          />

          {/* Documents Sheet */}
          <Sheet>
            <SheetTrigger render={(props) => (
              <Button {...props} variant="ghost" size="icon" title="Documents" className="h-9 w-9 sm:h-10 sm:w-10">
                <FileText className="h-4 w-4" />
              </Button>
            )} />
            <SheetContent side="left" className="w-80">
              <div className="mt-4 flex flex-col h-full">
                <p className="text-sm font-medium mb-2">Uploaded Documents</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Manage your uploaded documents here.
                </p>
                <Tabs
                  value={docFilter}
                  onValueChange={(v) => setDocFilter(v as typeof docFilter)}
                  className="flex-1 flex flex-col"
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="owned">Owned</TabsTrigger>
                    <TabsTrigger value="shared-with-me">Shared</TabsTrigger>
                    <TabsTrigger value="shared-by-me">By me</TabsTrigger>
                  </TabsList>
                  <div className="flex-1 overflow-y-auto mt-3">
                    <DocumentList standalone filter={docFilter} />
                  </div>
                </Tabs>
                <div className="mt-4 pt-3 border-t">
                  <Link href="/documents">
                    <Button variant="ghost" size="sm" className="w-full text-xs">
                      View all documents
                    </Button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Upload Dialog */}
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger render={(props) => (
              <Button {...props} variant="ghost" size="icon" title="Upload document" className="h-9 w-9 sm:h-10 sm:w-10">
                <Upload className="h-4 w-4" />
              </Button>
            )} />
            <DialogContent className="max-w-lg">
              <DocumentUpload />
            </DialogContent>
          </Dialog>

          {/* Dark mode toggle - hidden on small screens */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme" className="hidden sm:flex h-9 w-9 sm:h-10 sm:w-10">
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          {/* Notification bell */}
          <NotificationBell />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10" title="User menu">
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
              {sessionTimeRemaining !== null && sessionTimeRemaining <= THIRTY_MINUTES && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="cursor-default">
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className={sessionTimeRemaining <= 5 * 60 * 1000 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                      Session expires in {formatTimeRemaining(sessionTimeRemaining)}
                    </span>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenShortcutsHelp}>
                <Keyboard className="mr-2 h-4 w-4" />
                Keyboard shortcuts
                <span className="ml-auto text-xs text-muted-foreground">?</span>
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
