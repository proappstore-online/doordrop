// FCM dropped per port plan. PWA Web Push could replace it later (task #11).
export async function requestPushPermission(..._args: unknown[]): Promise<boolean> {
  return false;
}
export async function unregister(): Promise<void> { /* no-op */ }
export function isSupported(): boolean { return false; }
