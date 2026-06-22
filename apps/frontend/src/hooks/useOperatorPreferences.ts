import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OperatorPreferencesDto, OperatorPreferencesPatchDto } from '@trackmind/shared';
import { fetchOperatorPreferences, patchOperatorPreferences } from '@/api/identityApi';
import { applyLocalePreference, applyThemePreference, persistTheme, type ThemeName } from '@/lib/theme';
import { useTenantSession } from '@/auth/TenantSessionProvider';
import { demoAccessEnabled } from '@/auth/entraAuth';

export function operatorPreferencesQueryKey(userId?: string): readonly [string, string | undefined] {
  return ['operator-preferences', userId];
}

export function useOperatorPreferences() {
  const { session } = useTenantSession();
  const queryClient = useQueryClient();
  const enabled = Boolean(session.userId && session.bearerToken);

  const query = useQuery({
    queryKey: operatorPreferencesQueryKey(session.userId),
    queryFn: async () => {
      const result = await fetchOperatorPreferences();
      if (result.status !== 'ready' || !result.data) {
        return {
          userId: session.userId ?? 'demo',
          tenantId: session.tenantId,
          theme: 'system' as const,
          locale: 'en-US',
          timezone: 'America/New_York',
          density: 'comfortable' as const,
          updatedAt: new Date().toISOString(),
          mock: true,
        } satisfies OperatorPreferencesDto;
      }
      return result.data;
    },
    enabled: enabled || demoAccessEnabled(),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (patch: OperatorPreferencesPatchDto) => {
      if (!session.bearerToken) {
        const next = { ...query.data!, ...patch, updatedAt: new Date().toISOString() };
        if (patch.theme) applyThemePreference(patch.theme);
        if (patch.locale) applyLocalePreference(patch.locale);
        return next;
      }
      const result = await patchOperatorPreferences(patch);
      if (result.status !== 'ready' || !result.data) throw new Error(result.message ?? 'Unable to save preferences');
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(operatorPreferencesQueryKey(session.userId), data);
      if (data.theme) {
        const resolved = data.theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : data.theme;
        persistTheme(resolved as ThemeName);
        applyThemePreference(data.theme);
      }
      if (data.locale) applyLocalePreference(data.locale);
    },
  });

  return { ...query, savePreferences: mutation.mutateAsync, saving: mutation.isPending };
}
