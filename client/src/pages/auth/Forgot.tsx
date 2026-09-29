import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button, Input } from '../../components/ui';
import AuthShell from './AuthShell';

const schema = z.object({ email: z.string().email('Enter a valid email') });
export default function Forgot() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const [sent, setSent] = useState(false);
  const onSubmit = async ({ email }: z.infer<typeof schema>) => {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setSent(true); // same message either way: never reveal whether an email is registered
  };
  if (sent) return <AuthShell title="Check your email" subtitle="If an account exists for that address, a reset link is on its way."><Link to="/login" className="text-navy underline">Back to sign in</Link></AuthShell>;
  return (
    <AuthShell title="Forgot password" subtitle="Enter your email and we will send a reset link.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" variant="gold" loading={isSubmitting} className="w-full">Send reset link</Button>
      </form>
    </AuthShell>
  );
}
