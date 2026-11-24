'use client';
import { useState } from 'react';
import Link from 'next/link';
import { nextPath } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { PasswordField } from '@/components/password-field';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
type Errors = { name?: string; email?: string; password?: string; confirm?: string; terms?: string; form?: string };

export default function Register() {
  const { register, user, ready } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const err: Errors = {};
    if (name.trim().length < 2) err.name = 'Please enter your full name.';
    if (!email.trim()) err.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) err.email = 'Enter a valid email address.';
    if (password.length < 8) err.password = 'Password must be at least 8 characters.';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) err.password = 'Use both letters and numbers.';
    if (confirm !== password) err.confirm = 'Passwords do not match.';
    if (!terms) err.terms = 'Please accept the terms to continue.';
    if (Object.keys(err).length === 0) {
      const msg = await register(name, email, password);
      if (msg) err.form = msg;
    }
    setErrors(err);
    if (Object.keys(err).length === 0) router.push(nextPath());
  }

  if (!ready) return <main className="auth-page" />;

  if (user) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <span className="eyebrow">ALREADY SIGNED IN</span>
          <h1>Hello, <em>{user.name}.</em></h1>
          <p>You are signed in as {user.email}.</p>
          <form onSubmit={(e) => e.preventDefault()}><Link className="button button-orange" href="/products">Continue shopping</Link></form>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">JOIN THE NEXORA COMMUNITY</span>
        <h1>Create your <em>account.</em></h1>
        <p>A simpler way to keep your favourite finds close.</p>
        <form onSubmit={onSubmit} noValidate>
          <label>Full name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" aria-invalid={!!errors.name} />
            {errors.name && <small className="err">{errors.name}</small>}
          </label>
          <label>Email address
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" aria-invalid={!!errors.email} />
            {errors.email && <small className="err">{errors.email}</small>}
          </label>
          <PasswordField label="Password" name="password" value={password} onChange={setPassword} placeholder="At least 8 characters, letters + numbers" autoComplete="new-password" error={errors.password} />
          <PasswordField label="Confirm password" name="confirm" value={confirm} onChange={setConfirm} placeholder="Repeat your password" autoComplete="new-password" error={errors.confirm} />
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', flexDirection: 'row' }}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ width: 'auto' }} />
            <span>I agree to the terms and privacy policy.</span>
          </label>
          {errors.terms && <small className="err">{errors.terms}</small>}
          {errors.form && <small role="alert" className="err">{errors.form}</small>}
          <button className="button button-orange" type="submit">Create account</button>
        </form>
        <small>Already have an account? <Link href="/login" className="text-link">Sign in</Link></small>
      </div>
    </main>
  );
}
