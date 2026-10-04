'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { updatePreferences } from '@/app/actions/settings';

/** Every zone the browser knows, so travel and relocation are covered. Native
 *  <select> is already type-to-search on both desktop and mobile, so a long
 *  list needs no combobox of our own. */
function allZones(): string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.('timeZone');
    if (supported?.length) return supported;
  } catch {
    // Older engines without supportedValuesOf — the saved zone is still listed
    // below, so the row stays usable even with nothing to choose from.
  }
  return [];
}

function detect(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

export function TimeZoneRow({ timezone: initial }: { timezone: string }) {
  const [timezone, setTimezone] = useState(initial);
  // The IANA list is the same on both sides of hydration, so it can be built
  // once at first render rather than patched in from an effect.
  const [zones] = useState<string[]>(allZones);
  const [clock, setClock] = useState('');

  // First visit with nothing saved — adopt the device's zone so dates are right
  // before the user ever opens this screen. The detected value is browser-only,
  // so it can't be read during render, and the state update rides the save's
  // callback: the row shows a zone only once it is actually stored.
  useEffect(() => {
    if (initial) return;
    const detected = detect();
    if (!detected) return;
    updatePreferences({ timezone: detected }).then((res) => {
      if (res.success) setTimezone(detected);
      else toast.error(res.error || 'Could not save time zone');
    });
  }, [initial]);

  // A clock in the chosen zone makes a wrong choice obvious at a glance.
  useEffect(() => {
    if (!timezone) return;
    const tick = () => {
      try {
        setClock(new Intl.DateTimeFormat('en-US', {
          timeZone: timezone, weekday: 'short', hour: 'numeric', minute: '2-digit',
        }).format(new Date()));
      } catch {
        setClock('');
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timezone]);

  async function change(next: string) {
    const previous = timezone;
    setTimezone(next);
    const res = await updatePreferences({ timezone: next });
    if (!res.success) {
      setTimezone(previous);
      toast.error(res.error || 'Could not save time zone');
    }
  }

  const options = timezone && !zones.includes(timezone) ? [timezone, ...zones] : zones;

  return (
    <div className="py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <span className="text-sm text-ink">Time Zone</span>
        <p className="text-[10px] text-ink-faint mt-0.5">
          {clock ? `Now ${clock} — decides which day “today” is` : 'Decides which day “today” is'}
        </p>
      </div>
      <select
        value={timezone}
        onChange={(e) => change(e.target.value)}
        className="text-sm text-ink-faint bg-transparent outline-none text-right appearance-none cursor-pointer max-w-[55%] truncate"
      >
        {!timezone && <option value="">Detecting…</option>}
        {options.map((z) => (
          <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
        ))}
      </select>
    </div>
  );
}
