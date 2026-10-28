import { useEffect, useState } from 'react';
import { AlertCircle, Bell, Key, ShieldCheck, Sliders, Sparkles } from 'lucide-react';
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
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-slate-800 text-sm">Account Security</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Security features currently configured for this portal.</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700">Two-factor authentication is not configured.</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          No verification or recovery flow is available, so this portal does not offer a 2FA toggle.
        </p>
      </section>

      <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
          <Key className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-slate-800 text-sm">Partner API Integration</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Manage credentials only when a real token service is configured.</p>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700">No partner API token is configured.</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Token creation, rotation, and revocation are not available in this portal yet.
        </p>
      </section>

      <section className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/50 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-display font-bold text-slate-800 text-sm">Google Gemini AI Engine</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Configure the optional key used by market insight tools.</p>
          </div>
        </div>
        <GeminiSettingsCard />
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

function GeminiSettingsCard() {
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    try {
      return localStorage.getItem('nova_gemini_api_key') || '';
    } catch (error) {
      console.warn('Could not read the Gemini API key from local storage', error);
      return '';
    }
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = () => {
    setSaveError('');
    try {
      if (apiKeyInput.trim()) {
        localStorage.setItem('nova_gemini_api_key', apiKeyInput.trim());
      } else {
        localStorage.removeItem('nova_gemini_api_key');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error('Could not save the Gemini API key', error);
      setSaved(false);
      setSaveError(error instanceof Error ? error.message : 'Could not save the API key.');
    }
  };

  return (
    <div className="space-y-3">
      <label htmlFor="geminiApiKey" className="block text-[10px] font-bold text-slate-500 font-display tracking-wider uppercase">GEMINI API KEY</label>
      <div className="flex gap-2">
        <div className="relative flex-1 flex items-center bg-white/40 border border-slate-200 rounded-xl h-11 px-3">
          <Key className="w-4 h-4 text-slate-400 mr-2" />
          <input
            id="geminiApiKey"
            className="bg-transparent border-none text-xs font-mono font-bold text-slate-600 focus:outline-none w-full outline-none"
            type="password"
            value={apiKeyInput}
            onChange={event => setApiKeyInput(event.target.value)}
            placeholder="Enter key (leave blank to clear)"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2.5 bg-primary text-white font-display text-xs font-bold rounded-xl hover:bg-secondary transition cursor-pointer shrink-0"
        >
          {saved ? 'Saved!' : 'Save Key'}
        </button>
      </div>
      {saveError && <p role="alert" className="text-xs text-rose-700">{saveError}</p>}
      <p className="text-[10px] text-slate-500 font-medium">
        This key is stored only in this browser and is not encrypted. Do not use a privileged production key here.
      </p>
    </div>
  );
}
