import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../lib/toast';
import { Button, Input } from '../../components/ui';
import AuthShell from './AuthShell';

const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(100),
  email: z.string().email('Enter a valid email'),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,18}$/, 'Enter a valid phone number'),
  password: z.string().min(8, 'Use at least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type F = z.infer<typeof schema>;

export default function Register() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({ resolver: zodResolver(schema) });
  const toast = useToast(); const nav = useNavigate();
  const [checkEmail, setCheckEmail] = useState(false);
  const onSubmit = async (v: F) => {
    const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password, options: { data: { full_name: v.full_name, phone: v.phone } } });
    if (error) return toast.error(error.message.toLowerCase().includes('registered') ? 'An account with this email already exists.' : 'Unable to create your account. Please try again.');
    if (data.session) { toast.success('Account created.'); nav('/dashboard'); } else setCheckEmail(true);
  };
  if (checkEmail) return <AuthShell title="Check your email" subtitle="We sent a confirmation link. Confirm your email, then sign in."><Link to="/login" className="text-navy underline">Go to sign in</Link></AuthShell>;
  return (
    <AuthShell title="Create your account" subtitle="You need an account to book an appointment.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="Full name" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone number" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
        <Input label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" variant="gold" loading={isSubmitting} className="w-full">Create account</Button>
      </form>
      <p className="mt-4 text-sm">Already registered? <Link to="/login" className="text-navy underline">Sign in</Link></p>
    </AuthShell>
  );
}
