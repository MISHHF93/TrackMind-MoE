import { useEffect, useState } from 'react';
import type { ConsolePayload } from '../design/opsTypes';

let activeConsole: ConsolePayload | undefined;
const listeners = new Set<() => void>();

export function setActiveConsole(payload: ConsolePayload | undefined): void {
  activeConsole = payload;
  listeners.forEach((listener) => listener());
}

export function getActiveConsole(): ConsolePayload | undefined {
  return activeConsole;
}

export function useActiveConsole(): ConsolePayload | undefined {
  const [payload, setPayload] = useState<ConsolePayload | undefined>(() => activeConsole);
  useEffect(() => {
    const listener = () => setPayload(activeConsole);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return payload;
}
