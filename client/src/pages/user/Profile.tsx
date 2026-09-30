import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errMsg } from '../../lib/api';
import { normalizeIndianPhone } from '../../lib/phone';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { Button, Input, PageTitle } from '../../components/ui';

const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: z.string().trim().refine((v) => normalizeIndianPhone(v) !== null, 'Enter a valid 10-digit mobile number'),
});
export default function Profile() {
  const { profile, refreshProfile } = useAuth(); const toast = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { full_name: profile?.full_name ?? '', phone: profile?.phone ?? '' } });
  const onSubmit = async (v: z.infer<typeof schema>) => {
    try { await api('/profile', { method: 'PATCH', body: v }); await refreshProfile(); toast.success('Profile updated.'); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <>
      <PageTitle title="Profile" />
      <form onSubmit={handleSubmit(onSubmit)} className="card max-w-lg space-y-4" noValidate>
        <Input label="Full name" error={errors.full_name?.message} {...register('full_name')} />
        <Input label="Mobile number" type="tel" hint="You can also use this number to sign in." error={errors.phone?.message} {...register('phone')} />
        <Input label="Email" value={profile?.email ?? ''} disabled readOnly hint="Email cannot be changed here." />
        <Button type="submit" variant="gold" loading={isSubmitting}>Save changes</Button>
      </form>
    </>
  );
}