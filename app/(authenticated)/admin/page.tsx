'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, MessageSquare, FileText, Shield, ArrowLeft, Cpu, KeyRound, Group } from 'lucide-react';
import Link from 'next/link';
import { PageLoading } from '@/components/page-loading';

interface Stats {
  totalUsers: number;
  totalConversations: number;
  totalAuditLogs: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats', { credentials: 'include' });
        if (!res.ok) {
          if (res.status === 403) {
            setError('Access denied. Admin privileges required.');
            return;
          }
          throw new Error('Failed to fetch stats');
        }
        const data = await res.json();
        setStats(data.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return <PageLoading message="Loading dashboard..." />;
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-destructive mb-4">{error}</div>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const statCards = [
    { title: 'Total Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-blue-500' },
    { title: 'Conversations', value: stats?.totalConversations ?? 0, icon: MessageSquare, color: 'text-green-500' },
    { title: 'Audit Logs', value: stats?.totalAuditLogs ?? 0, icon: FileText, color: 'text-orange-500' },
  ];

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">System overview and management</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/audit">
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Audit Logs
              </Button>
            </Link>
            <Link href="/admin/health">
              <Button variant="outline" size="sm">
                <Shield className="mr-2 h-4 w-4" />
                Health
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {statCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage user accounts and roles</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/users">
                  <Button variant="outline">Manage Users</Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Document Review</CardTitle>
                <CardDescription>Review pending documents for approval</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/documents">
                  <Button variant="outline">Review Queue</Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Model Management</CardTitle>
                <CardDescription>Pull, delete, and switch Ollama models</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/models">
                  <Button variant="outline">
                    <Cpu className="mr-2 h-4 w-4" />
                    Manage Models
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Group Management</CardTitle>
                <CardDescription>Manage groups and document access</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/groups">
                  <Button variant="outline">
                    <Group className="mr-2 h-4 w-4" />
                    Manage Groups
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Single Sign-On</CardTitle>
                <CardDescription>Configure SAML 2.0 SSO for your organization</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/sso">
                  <Button variant="outline">
                    <KeyRound className="mr-2 h-4 w-4" />
                    SSO Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
