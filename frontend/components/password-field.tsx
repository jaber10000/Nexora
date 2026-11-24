'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Password input with a show / hide toggle (used by Login and Register).
export function PasswordField({ label, name, value, onChange, placeholder, autoComplete, error }: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string; error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label>{label}
      <span style={{ position: 'relative', display: 'block' }}>
        <input name={name} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} autoComplete={autoComplete} aria-invalid={!!error} style={{ width: '100%', paddingRight: 44 }} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, cursor: 'pointer', color: 'inherit', display: 'grid' }}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {error && <small className="err">{error}</small>}
    </label>
  );
}
