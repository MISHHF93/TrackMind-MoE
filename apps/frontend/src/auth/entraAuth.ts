import type { AccountInfo, AuthenticationResult, PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined;
const authority = import.meta.env.VITE_ENTRA_AUTHORITY as string | undefined;

type MsalModule = typeof import('@azure/msal-browser');

let msalInstance: PublicClientApplication | undefined;
let msalModulePromise: Promise<MsalModule> | undefined;

export function entraAuthEnabled(): boolean {
  return import.meta.env.VITE_TRACKMIND_AUTH_PROVIDER === 'entra' && Boolean(clientId && authority);
}

export function devHeaderRoleEnabled(): boolean {
  return import.meta.env.VITE_TRACKMIND_AUTH_PROVIDER !== 'entra';
}

/** Demo mode: skip login and use header-role API auth for walkthroughs. Off when Entra is enabled. */
export function demoAccessEnabled(): boolean {
  if (import.meta.env.VITE_TRACKMIND_DEMO_BYPASS === 'false') return false;
  return !entraAuthEnabled();
}

async function loadMsalModule(): Promise<MsalModule> {
  if (!msalModulePromise) {
    msalModulePromise = import('@azure/msal-browser');
  }
  return msalModulePromise;
}

async function createMsal(): Promise<PublicClientApplication | undefined> {
  if (!entraAuthEnabled() || !clientId || !authority) return undefined;
  const { LogLevel, PublicClientApplication } = await loadMsalModule();
  return new PublicClientApplication({
    auth: {
      clientId,
      authority,
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
      },
    },
  });
}

export async function getMsalInstance(): Promise<PublicClientApplication | undefined> {
  if (!entraAuthEnabled()) return undefined;
  if (!msalInstance) {
    msalInstance = await createMsal();
    await msalInstance?.initialize();
  }
  return msalInstance;
}

export async function loginWithEntra(): Promise<AuthenticationResult | undefined> {
  const msal = await getMsalInstance();
  if (!msal) return undefined;
  const result = await msal.loginPopup({
    scopes: ['openid', 'profile', 'email', 'User.Read'],
  });
  return result;
}

export async function acquireEntraAccessToken(account: AccountInfo): Promise<string | undefined> {
  const msal = await getMsalInstance();
  if (!msal) return undefined;
  const result = await msal.acquireTokenSilent({
    account,
    scopes: ['openid', 'profile', 'email', 'User.Read'],
  }).catch(async () => msal.acquireTokenPopup({
    account,
    scopes: ['openid', 'profile', 'email', 'User.Read'],
  }));
  return result.accessToken;
}

export async function logoutEntra(): Promise<void> {
  const msal = await getMsalInstance();
  if (!msal) return;
  const account = msal.getAllAccounts()[0];
  if (account) await msal.logoutPopup({ account });
}
