'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [ssoRedirecting, setSsoRedirecting] = useState(false);

  // Handle SSO error from callback redirect
  useEffect(() => {
    const ssoError = searchParams.get('sso-error');
    if (ssoError === 'provisioning-disabled') {
      setError(
        'Your email is not provisioned in this organization. Contact your administrator.'
      );
    }
  }, [searchParams]);

  function extractDomain(emailAddr: string): string | null {
    const match = emailAddr.match(/^[^@]+@(.+)$/);
    return match ? match[1].toLowerCase() : null;
  }

  async function checkDomain(domain: string): Promise<{ ssoEnabled: boolean; orgSlug?: string }> {
    try {
      const res = await fetch('/api/auth/sso/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) return { ssoEnabled: false };
      return await res.json();
    } catch {
      return { ssoEnabled: false };
    }
  }

  async function handleEmailBlur() {
    if (!email || checkingDomain || ssoRedirecting) return;

    const domain = extractDomain(email);
    if (!domain) return;

    setCheckingDomain(true);
    setError('');

    try {
      const result = await checkDomain(domain);

      if (result.ssoEnabled && result.orgSlug) {
        // Redirect to SSO login — use window.location for the API route redirect
        setSsoRedirecting(true);
        window.location.href = `/api/auth/sso/login?org=${result.orgSlug}`;
        return;
      }

      // No SSO for this domain — show password form
      setShowPasswordForm(true);
    } catch {
      // On error, fall back to password form
      setShowPasswordForm(true);
    } finally {
      setCheckingDomain(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleEmailBlur();
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        setError(error.message || 'Login failed');
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6 rounded-lg border p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        {/* SSO Error Message */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Email input */}
        {!showPasswordForm && !ssoRedirecting && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                onBlur={handleEmailBlur}
                placeholder="you@company.com"
                required
                disabled={loading || checkingDomain}
                autoComplete="email"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || checkingDomain || !email}
            >
              {checkingDomain ? 'Checking...' : 'Continue'}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        )}

        {/* SSO Redirecting state */}
        {ssoRedirecting && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Your organization uses single sign-on. Redirecting...
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSsoRedirecting(false);
                  setShowPasswordForm(true);
                }}
              >
                Use password instead
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Password form (fallback for non-SSO domains) */}
        {showPasswordForm && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                required
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs text-primary underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPasswordForm(false);
                  setEmail('');
                  setPassword('');
                }}
              >
                Back
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
