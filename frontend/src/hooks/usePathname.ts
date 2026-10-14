import { useSyncExternalStore } from 'react';
import { getCurrentPathname, subscribeToPathname } from '../navigation';

export function usePathname(): string {
  return useSyncExternalStore(subscribeToPathname, getCurrentPathname, () => '/');
}
