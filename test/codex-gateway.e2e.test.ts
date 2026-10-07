import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { runHarness } from './support/cli';

test('gateway CLI refuses readable or weak token files without starting inference', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-gateway-'));
	try {
		const path = join(root, 'token');
		await writeFile(path, 'synthetic-gateway-token-that-is-long-enough', { mode: 0o644 });
		const unsafe = await runHarness(['codex', 'serve', '--token-file', path], root, false);
		expect(unsafe.exitCode).toBe(1);
		expect(unsafe.stderr).toContain('owner-only');
		expect(unsafe.stdout + unsafe.stderr).not.toContain('synthetic-gateway-token');
		await chmod(path, 0o600);
		await writeFile(path, 'short');
		const weak = await runHarness(['codex', 'serve', '--token-file', path], root, false);
		expect(weak.exitCode).toBe(1);
		expect(weak.stderr).toContain('32 characters');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
