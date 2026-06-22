import type { OperatorThemePreference } from '@trackmind/shared';
import { useEffect, useState, type ReactElement } from 'react';
import { useOperatorPreferences } from '@/hooks/useOperatorPreferences';
import { Button } from '@/design/components/button';
import { SectionPanel } from '@/design/components/section-panel';

const locales = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'fr-CA', label: 'Français (Canada)' },
];

const timezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
];

export function AccountPreferencesTab(): ReactElement {
  const { data, savePreferences, saving } = useOperatorPreferences();
  const [theme, setTheme] = useState<OperatorThemePreference>('system');
  const [locale, setLocale] = useState('en-US');
  const [timezone, setTimezone] = useState('America/New_York');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!data) return;
    setTheme(data.theme);
    setLocale(data.locale);
    setTimezone(data.timezone);
    setDensity(data.density);
  }, [data]);

  async function handleSave() {
    try {
      await savePreferences({ theme, locale, timezone, density });
      setMessage('Preferences saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save preferences.');
    }
  }

  return (
    <SectionPanel title="Workspace preferences" description="Theme, locale, and timezone apply to this operator profile.">
      <div className="grid max-w-lg gap-4">
        <label className="grid gap-1 text-sm">
          <span>Theme</span>
          <select className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={theme} onChange={(e) => setTheme(e.target.value as OperatorThemePreference)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Locale</span>
          <select className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={locale} onChange={(e) => setLocale(e.target.value)}>
            {locales.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Timezone</span>
          <select className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span>Density</span>
          <select className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2" value={density} onChange={(e) => setDensity(e.target.value as 'comfortable' | 'compact')}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <Button size="sm" className="w-fit" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
        {message ? <p className="text-xs text-[var(--muted-foreground)]">{message}</p> : null}
      </div>
    </SectionPanel>
  );
}
