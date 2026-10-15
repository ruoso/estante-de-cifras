// useOnline — the device's online state, read from navigator and kept live by
// the network events. The account screen's network-only actions (deleting the
// account — workflow 17 §Offline; the recovery email — workflow 13 L66–68) wait
// on it; nothing else does. In a test with no navigator this defaults to online.

import { useEffect, useState } from 'react';

export function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    globalThis.addEventListener?.('online', up);
    globalThis.addEventListener?.('offline', down);
    return () => {
      globalThis.removeEventListener?.('online', up);
      globalThis.removeEventListener?.('offline', down);
    };
  }, []);
  return online;
}
