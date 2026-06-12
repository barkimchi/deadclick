/**
 * Messaging contracts across DeadClick's three contexts:
 *   MAIN-world gatekeeper  <-- window.postMessage -->  isolated shield
 *   isolated shield / popup  <-- chrome.runtime -->  background service worker
 */

/** Tag stamped on every window.postMessage so we ignore page chatter. */
export const BRIDGE_TAG = 'deadclick:v1' as const;

/** isolated shield -> MAIN-world gatekeeper: current on/off + allowlist state. */
export interface IsolatedToShim {
  tag: typeof BRIDGE_TAG;
  dir: 'iso->shim';
  kind: 'config';
  enabled: boolean;
  allowlisted: boolean;
}

/** MAIN-world gatekeeper -> isolated shield: "I just blocked a popup". */
export interface ShimToIsolated {
  tag: typeof BRIDGE_TAG;
  dir: 'shim->iso';
  kind: 'blocked';
  layer: 'popup';
  reason: string;
  url: string;
}

export type BlockLayer = 'popup' | 'overlay' | 'redirect';

/** chrome.runtime messages. */
export type RuntimeMessage =
  | { type: 'dc:blocked'; layer: BlockLayer; reason: string }
  | { type: 'dc:reset' };

/** Storage keys (chrome.storage.local). */
export const KEY_ENABLED = 'dc:enabled';
export const KEY_ALLOWLIST = 'dc:allowlist';
