'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Filter } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  timestamp: number;
  metadata: string | null;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ userId: '', action: '', fromDate: '', toDate: '' });

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '50',
          ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
        });

        const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch audit logs');

        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [page, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Audit Log Viewer</h1>
            <p className="text-sm text-muted-foreground">System activity and audit trail</p>
          </div>
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>

        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Filter by user ID"
            value={filters.userId}
            onChange={(e) => handleFilterChange('userId', e.target.value)}
          />
          <Input
            placeholder="Filter by action"
            value={filters.action}
            onChange={(e) => handleFilterChange('action', e.target.value)}
          />
          <Input
            type="date"
            value={filters.fromDate}
            onChange={(e) => handleFilterChange('fromDate', e.target.value)}
            placeholder="From date"
          />
          <Input
            type="date"
            value={filters.toDate}
            onChange={(e) => handleFilterChange('toDate', e.target.value)}
            placeholder="To date"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">{error}</div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell className="text-sm">{log.userEmail}</TableCell>
                      <TableCell className="text-sm font-mono">{log.action}</TableCell>
                      <TableCell className="text-sm">{log.resource}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {log.metadata || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
