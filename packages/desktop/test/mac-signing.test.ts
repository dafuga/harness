import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

test.runIf(process.platform === 'darwin')(
	'packaging refuses ambiguous or unavailable signing identities before writing the app',
	() => {
		const directory = mkdtempSync(join(tmpdir(), 'harness-signing-'));
		const script = resolve(import.meta.dirname, '../scripts/package-mac.ts');
		try {
			for (const identity of ['', '-', 'Daniel', '0'.repeat(40)]) {
				const run = spawnSync('bun', [script], {
					cwd: directory,
					encoding: 'utf8',
					env: { ...process.env, HARNESS_MAC_SIGN_IDENTITY: identity }
				});
				expect(run.status, identity).not.toBe(0);
				expect(run.stderr, identity).toContain('HARNESS_MAC_SIGN_IDENTITY');
				expect(readdirSync(directory)).toEqual([]);
			}
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}
);
