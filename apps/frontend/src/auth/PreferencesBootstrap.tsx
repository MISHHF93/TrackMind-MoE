import { useEffect } from 'react';
import { applyLocalePreference, applyThemePreference } from '@/lib/theme';
import { useOperatorPreferences } from '@/hooks/useOperatorPreferences';

/** Applies saved operator theme/locale once preferences are loaded. */
export function PreferencesBootstrap(): null {
  const { data } = useOperatorPreferences();

  useEffect(() => {
    if (!data) return;
    applyThemePreference(data.theme);
    applyLocalePreference(data.locale);
  }, [data]);

  return null;
}
