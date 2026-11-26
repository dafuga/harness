import { mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { QaSyncStateRepository } from '../../../src/repositories/agents-providers/QaSyncStateRepository';

const file = async () => join(await mkdtemp(join(tmpdir(), 'qa-sync-state-')), 'state.json');

test('QaSyncStateRepository round-trips owner-only state', async () => {
	const path = await file();
	const store = new QaSyncStateRepository(path);
	await expect(store.load()).resolves.toBeUndefined();
	const state = { version: 1 as const, since: '1.000001', threads: {} };
	await store.save(state);
	await expect(store.load()).resolves.toEqual(state);
	expect((await stat(path)).mode & 0o777).toBe(0o600);
});

test('QaSyncStateRepository fails on a damaged file instead of starting over', async () => {
	const path = await file();
	await writeFile(path, '{"version":2}');
	await expect(new QaSyncStateRepository(path).load()).rejects.toThrow('unknown format');
});

test('QaSyncStateRepository allows one run at a time and replaces a dead lock', async () => {
	const path = await file();
	const store = new QaSyncStateRepository(path);
	await store.exclusive(async () => {
		await expect(store.exclusive(async () => 1)).rejects.toThrow('Another QA sync');
	});
	await writeFile(`${path}.lock`, '999999999');
	await expect(store.exclusive(async () => 2)).resolves.toBe(2);
});
