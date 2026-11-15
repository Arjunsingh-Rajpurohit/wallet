/**
 * The talking-to-Google part of the Drive copy, kept free of the app so it can be tested.
 * The file lives in Drive's hidden "app data" folder: only this app can see it, and the app
 * can see nothing else in the person's Drive.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export interface RemoteFile {
  id: string;
  /** Changes every time the file is written, from any phone. */
  modifiedTime: string;
}

export class DriveError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type Fetch = typeof fetch;

async function call(doFetch: Fetch, token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await doFetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new DriveError(res.status === 401 ? 'Sign in with Google again.' : `Google Drive said no (${res.status}).`, res.status);
  }
  return res;
}

export async function findFile(token: string, name: string, doFetch: Fetch = fetch): Promise<RemoteFile | null> {
  const q = encodeURIComponent(`name = '${name}'`);
  const res = await call(doFetch, token, `${API}?spaces=appDataFolder&q=${q}&orderBy=modifiedTime%20desc&fields=files(id,modifiedTime)`);
  const files = ((await res.json()) as { files?: RemoteFile[] }).files ?? [];
  return files[0] ?? null;
}

export async function readFile(token: string, id: string, doFetch: Fetch = fetch): Promise<string> {
  return (await call(doFetch, token, `${API}/${id}?alt=media`)).text();
}

/** Writes the file (making it the first time) and returns it with its new modified time. */
export async function writeFile(token: string, name: string, json: string, id: string | null, doFetch: Fetch = fetch): Promise<RemoteFile> {
  if (id) {
    const res = await call(doFetch, token, `${UPLOAD}/${id}?uploadType=media&fields=id,modifiedTime`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json,
    });
    return (await res.json()) as RemoteFile;
  }
  const boundary = `fw${Math.random().toString(36).slice(2)}`;
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
    + `${JSON.stringify({ name, parents: ['appDataFolder'] })}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  const res = await call(doFetch, token, `${UPLOAD}?uploadType=multipart&fields=id,modifiedTime`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
  return (await res.json()) as RemoteFile;
}

export type SyncStep = 'pull' | 'push' | 'ask' | 'none';

/**
 * What one sync does.
 * - Drive changed elsewhere, nothing new here (or a fresh install): take Drive's copy.
 * - Something new here, Drive untouched (or empty): send this phone's copy.
 * - Both changed: ask — never silently drop either side.
 */
export function nextStep(o: { remote: RemoteFile | null; seen: string | undefined; dirty: boolean; empty: boolean }): SyncStep {
  const remoteChanged = !!o.remote && o.remote.modifiedTime !== o.seen;
  if (!o.remote) return o.empty ? 'none' : 'push';
  if (remoteChanged) return o.empty || !o.dirty ? 'pull' : 'ask';
  return o.dirty ? 'push' : 'none';
}
