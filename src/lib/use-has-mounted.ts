import { useSyncExternalStore } from "react";

// The app is static-exported, so every page's HTML is frozen at build
// time. Anything that only exists in the browser - the current clock,
// localStorage - would otherwise render one value into that frozen HTML
// and a different one on the client, which React reports as a hydration
// mismatch. Gate those reads on this hook and render a placeholder until
// after hydration.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHasMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
