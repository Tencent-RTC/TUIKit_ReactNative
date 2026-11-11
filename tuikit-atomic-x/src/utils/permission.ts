import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

export type AppPermissionKind = 'camera' | 'microphone';
export type AppAuthorizationStatus = 'authorized' | 'denied' | 'not determined';

interface PermissionModuleInterface {
  getAuthorizationStatus(
    kind: AppPermissionKind
  ): Promise<AppAuthorizationStatus>;
}

const permissionModule = NativeModules.PermissionModule as
  | PermissionModuleInterface
  | undefined;

export async function isAppPermissionDenied(
  kind: AppPermissionKind
): Promise<boolean> {
  if (!permissionModule) return false;
  try {
    return (await permissionModule.getAuthorizationStatus(kind)) === 'denied';
  } catch {
    return false;
  }
}

export type AndroidPermissionResult = 1 | 0 | -1;

type AndroidMediaPermission =
  | 'android.permission.CAMERA'
  | 'android.permission.RECORD_AUDIO';

let permissionPromptCount = 0;

// The system permission dialog moves the app out of 'active', which must not be handled as the user leaving.
export function isPermissionPrompting(): boolean {
  return permissionPromptCount > 0;
}

export async function requestAndroidPermission(
  permission: AndroidMediaPermission
): Promise<AndroidPermissionResult> {
  if (Platform.OS !== 'android') return 1;
  permissionPromptCount += 1;
  try {
    const result = await PermissionsAndroid.request(permission);
    if (result === PermissionsAndroid.RESULTS.GRANTED) return 1;
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return -1;
    return 0;
  } catch {
    return 0;
  } finally {
    permissionPromptCount = Math.max(0, permissionPromptCount - 1);
  }
}

export async function ensureMediaPermission(
  kind: AppPermissionKind
): Promise<AndroidPermissionResult> {
  if (Platform.OS !== 'android') {
    return (await isAppPermissionDenied(kind)) ? -1 : 1;
  }
  const permission: AndroidMediaPermission =
    kind === 'camera'
      ? 'android.permission.CAMERA'
      : 'android.permission.RECORD_AUDIO';
  try {
    if (await PermissionsAndroid.check(permission)) return 1;
  } catch {}
  return requestAndroidPermission(permission);
}
