import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../lib/toast';
import { Button, Input } from '../../components/ui';
import AuthShell from './AuthShell';

const schema = z.object({ password: z.string().min(8, 'Use at least 8 characters'), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
export default function Reset() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const toast = useToast(); const nav = useNavigate();
  const onSubmit = async (v: z.infer<typeof schema>) => {
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) return toast.error('This reset link is invalid or has expired. Please request a new one.');
    toast.success('Password updated.'); nav('/dashboard');
  };
  return (
    <AuthShell title="Set a new password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" variant="gold" loading={isSubmitting} className="w-full">Update password</Button>
      </form>
    </AuthShell>
  );
}
