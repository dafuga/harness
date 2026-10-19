import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { NativeConnectionService } from '../../src/services/NativeConnectionService';
import { ProjectionCacheService } from '../../src/services/projection-cache-service/ProjectionCacheService';
test('unconfigured native hosting exposes no transport or login authority', () => {
	const open = vi.fn(),
		encryption = {
			isEncryptionAvailable: () => false,
			encryptString: () => Buffer.alloc(0),
			decryptString: () => ''
		};
	expect(
		new NativeConnectionService().create(
			{ file: '/unused/session.enc', cache: new ProjectionCacheService('/unused/cache'), open },
			encryption
		)
	).toEqual({});
	expect(open).not.toHaveBeenCalled();
});

test('disconnect emits global denial and clears only disposable cache', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-disconnect-'));
	try {
		const events: unknown[] = [];
		const connection = new NativeConnectionService().create(
			{
				origin: 'https://example.invalid',
				file: join(root, 'session.enc'),
				cache: new ProjectionCacheService(join(root, 'cache')),
				open: async () => {},
				onCacheStatus: (status) => events.push(status)
			},
			{
				isEncryptionAvailable: () => true,
				encryptString: Buffer.from,
				decryptString: (value) => value.toString()
			}
		);
		await writeFile(join(root, 'outbox.json'), 'pending draft');
		await connection.auth!.disconnect();
		expect(events).toEqual([{ projectId: '$projects', status: 'denied' }]);
		expect(await readFile(join(root, 'outbox.json'), 'utf8')).toBe('pending draft');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
