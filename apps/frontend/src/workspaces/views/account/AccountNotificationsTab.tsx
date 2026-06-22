import type { NotificationChannelPreferenceDto } from '@trackmind/shared';
import { useEffect, useState, type ReactElement } from 'react';
import { fetchNotificationPreferences, patchNotificationPreferences } from '@/api/sessionApi';
import { Button } from '@/design/components/button';
import { SectionPanel } from '@/design/components/section-panel';

export function AccountNotificationsTab({ userId }: { userId?: string }): ReactElement {
  const [channels, setChannels] = useState<NotificationChannelPreferenceDto[]>([]);
  const [prefsMessage, setPrefsMessage] = useState<string | undefined>();

  useEffect(() => {
    void fetchNotificationPreferences().then((result) => {
      if (result.status === 'ready' && result.data?.channels) setChannels(result.data.channels);
    });
  }, [userId]);

  async function savePreferences() {
    const result = await patchNotificationPreferences(channels);
    setPrefsMessage(result.status === 'ready' ? 'Notification preferences saved.' : result.message ?? 'Unable to save preferences.');
  }

  return (
    <SectionPanel title="Notification channels" description="Choose which operational channels can reach you while on duty.">
      <div className="max-w-md space-y-2">
        {channels.map((channel, index) => (
          <label key={channel.channel} className="flex items-center justify-between gap-3 text-sm">
            <span>{channel.channel}</span>
            <input
              type="checkbox"
              checked={channel.enabled}
              onChange={(event) => {
                const next = [...channels];
                next[index] = { ...channel, enabled: event.target.checked };
                setChannels(next);
              }}
            />
          </label>
        ))}
        {channels.length === 0 ? <p className="text-sm text-[var(--muted-foreground)]">No notification channels configured for this persona.</p> : null}
        <Button size="sm" onClick={() => void savePreferences()}>Save preferences</Button>
        {prefsMessage ? <p className="text-xs text-[var(--muted-foreground)]">{prefsMessage}</p> : null}
      </div>
    </SectionPanel>
  );
}
