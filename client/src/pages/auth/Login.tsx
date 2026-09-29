import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { Button, Input } from '../../components/ui';
import AuthShell from './AuthShell';

const schema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
type F = z.infer<typeof schema>;

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({ resolver: zodResolver(schema) });
  const nav = useNavigate(); const loc = useLocation(); const toast = useToast(); const { session, profile } = useAuth();
  const from = (loc.state as { from?: string } | null)?.from;
  if (session && profile) return <Navigate to={from ?? (profile.role === 'admin' ? '/admin' : '/dashboard')} replace />;
  const onSubmit = async (v: F) => {
    const { error } = await supabase.auth.signInWithPassword(v);
    if (error) return toast.error(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : 'Unable to sign in. Please try again.');
    nav(from ?? '/dashboard', { replace: true });
  };
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to book and manage your appointments.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Button type="submit" variant="gold" loading={isSubmitting} className="w-full">Sign in</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm"><Link to="/forgot-password" className="text-navy underline">Forgot password?</Link><Link to="/register" className="text-navy underline">Create account</Link></div>
    </AuthShell>
  );
}
