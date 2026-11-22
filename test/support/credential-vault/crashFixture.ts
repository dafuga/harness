import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { expect } from 'vitest';
import { VaultBrowserDockerAdapter } from '../../../src/adapters/accounts-access/VaultBrowserDockerAdapter';
import { withTempDir } from '../temporary';
import { approved, assertFixtureRemoved } from './dockerBrowser';

export async function verifyCrashRecovery(image: string): Promise<void> {
	await withTempDir('vault-crash-', async (root) => {
		const journal = join(root, 'receipts');
		const prior = await interruptGuest(journal);
		expect(await readdir(journal)).toEqual([prior + '.json']);
		const adapter = new VaultBrowserDockerAdapter({
			image,
			journal,
			context: process.env.HARNESS_TEST_VAULT_DOCKER_CONTEXT,
			seccomp: join(process.cwd(), 'deploy/vault/seccomp.json')
		});
		const next = await adapter.launch({ origins: [approved], redirects: [] });
		try {
			await assertFixtureRemoved(prior);
			expect(await readdir(journal)).toEqual([next.owner + '.json']);
		} finally {
			await next.close();
		}
		expect(await readdir(journal)).toEqual([]);
	});
}

async function interruptGuest(journal: string): Promise<string> {
	const child = spawn('bun', ['test/support/credential-vault/crashGuest.ts', journal], {
		stdio: ['ignore', 'pipe', 'inherit']
	});
	const lines = createInterface({ input: child.stdout });
	const exited = once(child, 'exit');
	try {
		const [id] = await once(lines, 'line', { signal: AbortSignal.timeout(12_000) });
		expect(id).toMatch(/^[a-f0-9-]{36}$/u);
		return String(id);
	} finally {
		lines.close();
		child.kill('SIGKILL');
		await exited;
	}
}
