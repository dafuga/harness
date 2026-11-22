import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from './verificationExpect';
import { moduleTaskFixture } from './support/moduleTaskFixture';

test('a Claude quota rejection pauses the next dispatch with exit 75 and no provider call', async () => {
	const f = await moduleTaskFixture();
	try {
		await f.feature();
		const explicit = { model: 'claude-haiku-5-5', intelligence: 'high' };
		await f.cli(['add', '--input', await f.input(explicit)]);
		await f.cli(['add', '--input', await f.input({ ...explicit, id: 'orders-retry' })]);
		await writeFile(join(f.root, 'mode'), 'quota');
		const rejected = await f.cli(['worker', '--worker', 'owner', '--once', '--json'], false);
		expect(JSON.parse(rejected.stdout).result.error).toBe('Claude quota exhausted.');
		await writeFile(join(f.root, 'mode'), '');
		const blocked = await f.cli(['worker', '--worker', 'owner', '--once', '--json'], false);
		expect(blocked.exitCode).toBe(75);
		expect(JSON.parse(blocked.stdout)).toMatchObject({
			status: 'blocked',
			problems: [expect.stringContaining('quota is exhausted until 2033-05-18T03:33:20.000Z')]
		});
		const calls = (await readFile(join(f.root, 'calls.ndjson'), 'utf8')).trim().split('\n');
		expect(calls, 'only the rejected run reached the provider').toHaveLength(1);
		const retry = JSON.parse((await f.cli(['show', 'orders-retry'])).stdout).task;
		expect(retry).toMatchObject({ status: 'queued', claimHistory: [], attempts: [] });
	} finally {
		await f.dispose();
	}
}, 30000);
