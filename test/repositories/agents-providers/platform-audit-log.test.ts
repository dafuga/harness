import { chmod, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { PlatformAuditEvent } from '../../../src/core/agents-providers/platformAdapter.types';
import { PlatformAuditLogRepository } from '../../../src/repositories/agents-providers/PlatformAuditLogRepository';
import { withTempDir } from '../../support/temporary';

test('appends private audit records and rejects a public file or symlink', async () => {
	const event: PlatformAuditEvent = {
		kind: 'send-attempt',
		platform: 'slack',
		installationId: 'fixture',
		workspaceId: 'TWORKSPACE',
		botId: 'BFIXTURE',
		timestampMs: 1700000000000,
		requestId: 'fixture-request',
		channelId: 'CAPPROVED'
	};
	await withTempDir('harness-platform-audit-', async (root) => {
		const path = join(root, 'platform.jsonl');
		const log = new PlatformAuditLogRepository(path);
		await Promise.all([log.append(event), log.append({ ...event, requestId: 'second-request' })]);
		expect((await stat(path)).mode & 0o777).toBe(0o600);
		const rows = (await readFile(path, 'utf8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(rows).toHaveLength(2);
		expect(rows).toContainEqual(event);

		const publicFile = join(root, 'public.jsonl');
		await writeFile(publicFile, '');
		await chmod(publicFile, 0o644);
		await expect(new PlatformAuditLogRepository(publicFile).append(event)).rejects.toThrow(
			'owner-only'
		);
		const linkedFile = join(root, 'linked.jsonl');
		await symlink(path, linkedFile);
		await expect(new PlatformAuditLogRepository(linkedFile).append(event)).rejects.toThrow();
		expect(await readFile(publicFile, 'utf8')).toBe('');
	});
});
