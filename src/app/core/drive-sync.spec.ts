import { describe, expect, it } from 'vitest';
import { findFile, nextStep, readFile, writeFile } from './drive-sync';

const remote = { id: 'f1', modifiedTime: '2026-11-15T10:00:00Z' };

describe('what a sync does', () => {
  it('a new phone takes the copy in Drive', () => {
    expect(nextStep({ remote, seen: undefined, dirty: false, empty: true })).toBe('pull');
  });
  it('the first sign-in with data sends it', () => {
    expect(nextStep({ remote: null, seen: undefined, dirty: true, empty: false })).toBe('push');
    expect(nextStep({ remote: null, seen: undefined, dirty: false, empty: false })).toBe('push');
  });
  it('nothing anywhere: nothing to do', () => {
    expect(nextStep({ remote: null, seen: undefined, dirty: false, empty: true })).toBe('none');
  });
  it('a new entry here goes to Drive', () => {
    expect(nextStep({ remote, seen: remote.modifiedTime, dirty: true, empty: false })).toBe('push');
  });
  it('another phone changed Drive: this one follows', () => {
    expect(nextStep({ remote, seen: '2026-11-14T10:00:00Z', dirty: false, empty: false })).toBe('pull');
  });
  it('both changed: ask, never drop one silently', () => {
    expect(nextStep({ remote, seen: '2026-11-14T10:00:00Z', dirty: true, empty: false })).toBe('ask');
  });
  it('all the same: nothing', () => {
    expect(nextStep({ remote, seen: remote.modifiedTime, dirty: false, empty: false })).toBe('none');
  });
});

describe('talking to Drive', () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fake = (answer: unknown, status = 200) => (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof answer === 'string' ? answer : JSON.stringify(answer), { status });
  }) as unknown as typeof fetch;

  it('looks only in the hidden app folder, with the pass', async () => {
    calls.length = 0;
    expect(await findFile('tok', 'fit-data.json', fake({ files: [remote] }))).toEqual(remote);
    expect(calls[0].url).toContain('spaces=appDataFolder');
    expect((calls[0].init!.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
    expect(await findFile('tok', 'fit-data.json', fake({ files: [] }))).toBeNull();
  });

  it('makes the file the first time, then updates the same one', async () => {
    calls.length = 0;
    await writeFile('tok', 'fit-data.json', '{"a":1}', null, fake(remote));
    expect(calls[0].init!.method).toBe('POST');
    expect(String(calls[0].init!.body)).toContain('appDataFolder');
    await writeFile('tok', 'fit-data.json', '{"a":2}', 'f1', fake(remote));
    expect(calls[1].init!.method).toBe('PATCH');
    expect(calls[1].url).toContain('/f1?');
    expect(calls[1].init!.body).toBe('{"a":2}');
  });

  it('reads the file back, and says so when the pass ran out', async () => {
    expect(await readFile('tok', 'f1', fake('{"a":1}'))).toBe('{"a":1}');
    await expect(readFile('tok', 'f1', fake('', 401))).rejects.toThrow('Sign in with Google again.');
  });
});
