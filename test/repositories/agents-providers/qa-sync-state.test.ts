import { stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { QaSyncStateRepository } from '../../../src/repositories/agents-providers/QaSyncStateRepository';
import { withTempDir } from '../../support/temporary';

const withState = (use: (path: string) => Promise<void>) =>
	withTempDir('qa-sync-state-', (root) => use(join(root, 'state.json')));

test('QaSyncStateRepository round-trips owner-only state', () =>
	withState(async (path) => {
		const store = new QaSyncStateRepository(path);
		await expect(store.load()).resolves.toBeUndefined();
		const state = { version: 1 as const, since: '1.000001', threads: {} };
		await store.save(state);
		await expect(store.load()).resolves.toEqual(state);
		expect((await stat(path)).mode & 0o777).toBe(0o600);
	}));

test('QaSyncStateRepository fails on a damaged file instead of starting over', () =>
	withState(async (path) => {
		await writeFile(path, '{"version":2}');
		await expect(new QaSyncStateRepository(path).load()).rejects.toThrow('unknown format');
	}));

test('QaSyncStateRepository allows one run at a time and replaces a dead lock', () =>
	withState(async (path) => {
		const store = new QaSyncStateRepository(path);
		await store.exclusive(async () => {
			await expect(store.exclusive(async () => 1)).rejects.toThrow('Another QA sync');
		});
		await writeFile(`${path}.lock`, '999999999');
		await expect(store.exclusive(async () => 2)).resolves.toBe(2);
	}));
