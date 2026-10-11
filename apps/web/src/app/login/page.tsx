'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Sparkles, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Brand } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { api, preview } from '@/lib/data';
const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must contain at least 8 characters'),
});
export default function Login() {
  const router = useRouter();
  const client = useQueryClient();
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  return (
    <div className="login-page">
      <section className="login-story">
        <Link href="/">
          <Brand />
        </Link>
        <div className="login-story-content">
          <span className="welcome-orb">
            <Sparkles size={33} />
          </span>
          <h1>
            A clear view.
            <br />A confident next move.
          </h1>
          <p>
            Your finance data has answers.
            <br />
            Let’s help you find them.
          </p>
          <div className="login-quote">
            <span>THE FINSIGHT APPROACH</span>
            <p>
              “Every number has a source.
              <br />
              Every insight should, too.”
            </p>
            <small>Financial intelligence you can trace.</small>
          </div>
        </div>
        <span className="hero-note">
          <ShieldCheck size={15} />
          Private by design. Evidence by default.
        </span>
      </section>
      <section className="login-form-section">
        <form
          className="login-form"
          onSubmit={form.handleSubmit(async (data) => {
            setError('');
            try {
              const user = await api<{ role: string }>('/auth/login', {
                method: 'POST',
                body: JSON.stringify(data),
              });
              client.clear();
              router.replace(user.role === 'EMPLOYEE' ? '/expenses' : '/dashboard');
            } catch (e) {
              setError((e as Error).message);
            }
          })}
        >
          <span className="eyebrow">WELCOME BACK</span>
          <h1>Sign in to FinSight</h1>
          <p>Your workspace is ready for a fresh perspective.</p>
          <label>
            Email address
            <input
              {...form.register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
            />
          </label>
          {form.formState.errors.email && (
            <span className="form-error">{form.formState.errors.email.message}</span>
          )}
          <label>
            Password
            <div className="password-input">
              <input
                {...form.register('password')}
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                aria-label={show ? 'Hide password' : 'Show password'}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {form.formState.errors.password && (
            <span className="form-error">{form.formState.errors.password.message}</span>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign in to workspace'}
            <ArrowRight size={17} />
          </Button>
          {preview && (
            <div className="demo-login">
              <span>SYNTHETIC PREVIEW</span>
              <p>No connected authentication service in preview mode.</p>
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
                Explore the demo workspace
                <ArrowUpRightIcon />
              </Button>
            </div>
          )}
          <span className="login-footer">
            Need access? Contact your organization administrator.
          </span>
        </form>
      </section>
    </div>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={15} />;
}
