'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  FileText,
  FolderOpen,
  Cloud,
  User,
  LayoutDashboard,
  Users,
  Group,
  Cpu,
  KeyRound,
  Shield,
  Activity,
  BookTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  role?: string;
}

const userLinks = [
  { href: '/', label: 'Chat', icon: MessageSquare },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/collections', label: 'Collections', icon: FolderOpen },
  { href: '/templates', label: 'Templates', icon: BookTemplate },
  { href: '/settings/connectors', label: 'Connectors', icon: Cloud },
  { href: '/profile', label: 'Profile', icon: User },
];

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/groups', label: 'Groups', icon: Group },
  { href: '/admin/models', label: 'Models', icon: Cpu },
  { href: '/admin/sso', label: 'SSO', icon: KeyRound },
  { href: '/admin/audit', label: 'Audit', icon: Shield },
  { href: '/admin/health', label: 'Health', icon: Activity },
];

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col border-r bg-card">
      <div className="px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold">Doc Expert</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {userLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              pathname === link.href
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        ))}
      </nav>

      {role === 'admin' && (
        <>
          <div className="border-t px-3 py-2">
            <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
          </div>
          <nav className="space-y-1 px-3 py-2">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
