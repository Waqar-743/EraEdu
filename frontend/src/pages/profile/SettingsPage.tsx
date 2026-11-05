import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import PasswordInput from '../../components/shared/PasswordInput';
import { usePreferencesStore } from '../../store/preferencesStore';
import api from '../../services/api';

type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string };

const SettingsPage = () => {
  const { theme, setTheme, sidebarCollapsed, setSidebarCollapsed } = usePreferencesStore();
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { register, handleSubmit, getValues, reset, formState: { errors, isSubmitting } } = useForm<PasswordForm>();

  const changePassword = async ({ currentPassword, newPassword }: PasswordForm) => {
    setPasswordError(null);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      reset();
      toast.success('Your password has been changed.');
    } catch (error: any) {
      setPasswordError(error.response?.data?.error?.message || error.response?.data?.message || 'Could not change your password. Please try again.');
    }
  };

  return <div className="mx-auto max-w-3xl space-y-6">
    <header>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-700">Your account</p>
      <h1 className="mt-1 font-display text-3xl text-ink-900">Settings</h1>
      <p className="mt-2 text-sm text-ink-500">Choose your appearance and manage your password.</p>
      <Link to="/profile" className="mt-3 inline-block text-sm font-semibold text-primary-700 hover:underline">Edit your profile</Link>
    </header>

    <section className="rounded-3xl border border-ink-900/5 bg-white p-6 shadow-soft" aria-labelledby="appearance-heading">
      <h2 id="appearance-heading" className="text-xl text-ink-900">Appearance</h2>
      <p className="mt-1 text-sm text-ink-500">These preferences are saved in this browser.</p>
      <div className="mt-5 space-y-6">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-900">Theme</legend>
          <div className="flex flex-wrap gap-3">
            {(['light', 'dark'] as const).map((value) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-900/10 px-4 py-3 text-sm text-ink-800">
              <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} className="accent-primary-600" />
              {value === 'light' ? 'Light' : 'Dark'}
            </label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-900">Desktop sidebar</legend>
          <div className="flex flex-wrap gap-3">
            {[false, true].map((collapsed) => <label key={String(collapsed)} className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-900/10 px-4 py-3 text-sm text-ink-800">
              <input type="radio" name="sidebar" checked={sidebarCollapsed === collapsed} onChange={() => setSidebarCollapsed(collapsed)} className="accent-primary-600" />
              {collapsed ? 'Collapsed' : 'Expanded'}
            </label>)}
          </div>
        </fieldset>
      </div>
    </section>

    <section className="rounded-3xl border border-ink-900/5 bg-white p-6 shadow-soft" aria-labelledby="password-heading">
      <h2 id="password-heading" className="text-xl text-ink-900">Change password</h2>
      <p id="password-requirements" className="mt-1 text-sm text-ink-500">Use 8–128 characters, including an uppercase letter, a lowercase letter and a number. Copy and paste are supported.</p>
      <form className="mt-5 space-y-4" onSubmit={handleSubmit(changePassword)}>
        <div>
          <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-ink-800">Current password</label>
          <PasswordInput id="current-password" autoComplete="current-password" className="input-field" aria-invalid={Boolean(errors.currentPassword)} aria-describedby={errors.currentPassword ? 'current-password-error' : undefined} {...register('currentPassword', { required: 'Enter your current password.', maxLength: { value: 128, message: 'Password must be at most 128 characters.' } })} />
          {errors.currentPassword && <p id="current-password-error" className="mt-1 text-sm text-rose-700">{errors.currentPassword.message}</p>}
        </div>
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-ink-800">New password</label>
          <PasswordInput id="new-password" autoComplete="new-password" className="input-field" aria-invalid={Boolean(errors.newPassword)} aria-describedby={`password-requirements${errors.newPassword ? ' new-password-error' : ''}`} {...register('newPassword', {
            required: 'Enter a new password.',
            minLength: { value: 8, message: 'Use at least 8 characters.' },
            maxLength: { value: 128, message: 'Use at most 128 characters.' },
            pattern: { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: 'Include an uppercase letter, a lowercase letter and a number.' },
            validate: (value) => value !== getValues('currentPassword') || 'Choose a password different from your current password.',
          })} />
          {errors.newPassword && <p id="new-password-error" className="mt-1 text-sm text-rose-700">{errors.newPassword.message}</p>}
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-ink-800">Confirm new password</label>
          <PasswordInput id="confirm-password" autoComplete="new-password" className="input-field" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined} {...register('confirmPassword', { required: 'Confirm your new password.', validate: (value) => value === getValues('newPassword') || 'Passwords do not match.' })} />
          {errors.confirmPassword && <p id="confirm-password-error" className="mt-1 text-sm text-rose-700">{errors.confirmPassword.message}</p>}
        </div>
        {passwordError && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{passwordError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-500">Enter your current password to confirm this change.</p>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Changing password…' : 'Change password'}</button>
        </div>
      </form>
    </section>
  </div>;
};

export default SettingsPage;
