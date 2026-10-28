import { useEffect, useState } from 'react';
import { AlertCircle, Bell, FileText, HelpCircle, Sliders } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import {
  DEFAULT_VENDOR_NOTIFICATION_PREFERENCES,
  subscribeToVendorNotificationPreferences,
  updateVendorNotificationPreference,
  type VendorNotificationPreferences
} from '../services/VendorSettingsService';

interface SettingsProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  uid: string;
}

export default function Settings({ darkMode, onToggleDarkMode, uid }: SettingsProps) {
  const [preferences, setPreferences] = useState(DEFAULT_VENDOR_NOTIFICATION_PREFERENCES);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesError, setPreferencesError] = useState('');
  const [savingPreference, setSavingPreference] = useState<keyof VendorNotificationPreferences | null>(null);

  useEffect(() => {
    if (!uid) {
      setPreferencesLoading(false);
      setPreferencesError('Sign in again to load vendor notification preferences.');
      return;
    }

    setPreferencesLoading(true);
    setPreferencesError('');
    return subscribeToVendorNotificationPreferences(
      uid,
      savedPreferences => {
        setPreferences(savedPreferences);
        setPreferencesLoading(false);
      },
      error => {
        console.error('Failed to load vendor notification preferences', error);
        setPreferencesError(`Could not load preferences: ${error.message}`);
        setPreferencesLoading(false);
      }
    );
  }, [uid]);

  const updatePreference = async (
    preference: keyof VendorNotificationPreferences,
    enabled: boolean
  ) => {
    setSavingPreference(preference);
    setPreferencesError('');
    try {
      await updateVendorNotificationPreference(uid, preference, enabled);
    } catch (error) {
      console.error(`Failed to update ${preference} preference`, error);
      setPreferencesError(error instanceof Error
        ? `Could not save preferences: ${error.message}`
        : 'Could not save preferences. Please try again.');
    } finally {
      setSavingPreference(null);
    }
  };

  return (
    <div className="max-w-[800px] mx-auto pb-32 font-sans space-y-6 animate-fadeIn">
      <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-3">
          <Bell className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-slate-800 text-sm">System Notifications</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Choose which order and inventory alerts appear in the notification menu.</p>
          </div>
        </div>

        {preferencesError && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{preferencesError}</span>
          </div>
        )}

        <div className="space-y-4">
          <PreferenceToggle
            label="Order Placed Ticker"
            description="Show pending orders in the notification menu."
            checked={preferences.orderAlerts}
            disabled={preferencesLoading || savingPreference !== null || !uid}
            onChange={enabled => void updatePreference('orderAlerts', enabled)}
          />
          <PreferenceToggle
            label="Low Stock Warnings"
            description="Show products with 10 or fewer units in the notification menu."
            checked={preferences.stockWarnings}
            disabled={preferencesLoading || savingPreference !== null || !uid}
            onChange={enabled => void updatePreference('stockWarnings', enabled)}
          />
          {preferencesLoading && <p role="status" className="text-xs text-slate-500">Loading saved preferences…</p>}
          <p className="text-xs text-slate-500">
            AI market alert notifications are not configured in this portal yet.
          </p>
        </div>
      </section>

      <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
          <HelpCircle className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-slate-800 text-sm">Frequently Asked Questions</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Quick help for managing your vendor portal.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          <details className="group py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">How do I update product stock?</summary>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Open Products, choose Edit for the item, update Available Units, and save. Stock changes are reflected in the vendor catalog.
            </p>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Where can I see customer orders?</summary>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Open Orders to review orders associated with your vendor account. Order availability depends on the customer checkout service writing the order to NOVA.
            </p>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Where does try-on feedback appear?</summary>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Open Try-On Feedback to view customer ratings and comments linked to your products.
            </p>
          </details>
          <details className="group py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">How do I change notification preferences?</summary>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Use the System Notifications switches above. Your order and low-stock preferences are saved to your vendor account.
            </p>
          </details>
        </div>
      </section>

      <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-slate-800 text-sm">Privacy Policy</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">How information is used in the vendor portal.</p>
          </div>
        </div>
        <div className="space-y-3 text-xs leading-5 text-slate-500">
          <p>
            The portal uses account information to sign you in and associate your vendor profile with your business. Business profile details, product listings, inventory, and notification preferences are stored to provide vendor features.
          </p>
          <p>
            Order information and NOVA customer try-on ratings or comments may be shown to the vendor responsible for the related products so the vendor can manage orders and understand customer feedback.
          </p>
          <p>
            A Gemini API key entered before this setting was removed may remain in this browser&apos;s local storage and may be sent to Google when Market Insights uses it. The key is not encrypted by this portal.
          </p>
          <p>
            Portal data is processed using the configured Firebase services. Keep your sign-in credentials private and only enter information needed to manage your vendor account.
          </p>
        </div>
      </section>

      <section className="bg-white/65 hover:bg-white border border-slate-200 p-6 rounded-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sliders className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h2 className="font-display text-sm font-bold text-slate-800">Appearance</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium mt-0.5">
              Choose a light or dark theme. Your preference is saved on this device.
            </p>
          </div>
        </div>
        <ThemeToggle darkMode={darkMode} onToggle={onToggleDarkMode} />
      </section>
    </div>
  );
}

function PreferenceToggle({
  label,
  description,
  checked,
  disabled,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex justify-between items-center gap-4 py-2">
      <div>
        <p className="text-xs font-bold text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{description}</p>
      </div>
      <label className="relative inline-flex items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={event => onChange(event.target.checked)}
          aria-label={label}
          className="sr-only peer"
        />
        <span className="w-10 h-5.5 bg-slate-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-primary peer-disabled:opacity-50 transition-colors" />
      </label>
    </div>
  );
}
