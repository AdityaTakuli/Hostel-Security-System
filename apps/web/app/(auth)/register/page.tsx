'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, Button, fadeInUp } from '@hostel-monitor/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      // Registration successful, redirect to login
      router.push('/login');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial="initial"
        animate="animate"
        variants={fadeInUp}
        className="w-full max-w-md z-10"
      >
        <Card variant="elevated" className="p-8 backdrop-blur-xl bg-surface-elevated/80 border-border">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-mono font-bold">SYSTEM_AUTH</h1>
            <p className="text-text-secondary text-sm mt-2">Create a new operator account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded bg-alert-red/10 border border-alert-red/20 text-alert-red text-sm font-medium text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-text-secondary mb-2 uppercase">Operator Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-text-secondary mb-2 uppercase">Operator ID (Email)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-text-secondary mb-2 uppercase">Passcode</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-text-primary font-mono focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full h-12 font-mono uppercase tracking-widest glow-blue"
              loading={loading}
            >
              Initialize Account
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 text-center text-xs text-text-secondary">
             <Link href="/login" className="hover:text-accent-blue hover:underline transition-all">
                ALREADY AN OPERATOR? SIGN IN
             </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
