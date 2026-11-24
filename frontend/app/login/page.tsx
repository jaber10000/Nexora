'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, DEMO_EMAIL, DEMO_PASSWORD } from '@/components/auth-provider';
import { PasswordField } from '@/components/password-field';
import { nextPath } from '@/lib/api';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function Login() {
  const { login, user, ready, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const err: typeof errors = {};
    if (!email.trim()) err.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) err.email = 'Enter a valid email address.';
    if (!password) err.password = 'Password is required.';
    else if (password.length < 6) err.password = 'Password must be at least 6 characters.';
    if (!err.email && !err.password) { const msg = await login(email, password); if (msg) err.form = msg; }
    setErrors(err);
    if (Object.keys(err).length === 0) router.push(nextPath());
  }

  if (!ready) return <main className="auth-page" />;

  if (user) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <span className="eyebrow">SIGNED IN</span>
          <h1>Hello, <em>{user.name}.</em></h1>
          <p>You are signed in as {user.email}.</p>
          <form onSubmit={(e) => e.preventDefault()}>
            <Link className="button button-orange" href="/products">Continue shopping</Link>
            <Link className="button" href="/profile">My profile</Link>
            <Link className="button" href="/orders">My orders</Link>
            <Link className="button" href="/wishlist">My wishlist</Link>
            <button className="button" type="button" onClick={logout}>Sign out</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">WELCOME BACK</span>
        <h1>Good to see <em>you.</em></h1>
        <p>Sign in to continue to your NEXORA account.</p>
        <form onSubmit={onSubmit} noValidate>
          <label>Email address
            <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" aria-invalid={!!errors.email} />
            {errors.email && <small className="err">{errors.email}</small>}
          </label>
          <PasswordField label="Password" name="password" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" error={errors.password} />
          {errors.form && <small role="alert" className="err">{errors.form}</small>}
          <button className="button button-orange" type="submit">Sign in</button>
          <button className="text-link" type="button" style={{ background: 'none', border: 0, cursor: 'pointer', justifySelf: 'start' }}
            onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); setErrors({}); }}>Use demo account</button>
        </form>
        <small>New to NEXORA? <Link href="/register" className="text-link">Create an account</Link></small>
      </div>
    </main>
  );
}
