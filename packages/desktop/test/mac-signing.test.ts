import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

test.runIf(process.platform === 'darwin')(
	'packaging refuses missing signing configuration and rejects ad hoc release artifacts',
	() => {
		const directory = mkdtempSync(join(tmpdir(), 'harness-signing-'));
		const script = resolve(import.meta.dirname, '../scripts/package-mac.ts');
		try {
			mkdirSync(join(directory, 'build'));
			mkdirSync(join(directory, 'dist'));
			for (const entry of ['main.cjs', 'preload.cjs']) {
				writeFileSync(join(directory, 'dist', entry), '');
			}
			const env = { PATH: process.env.PATH, HOME: directory };
			const run = (args: string[], identity?: string) =>
				spawnSync('bun', [script, ...args], {
					cwd: directory,
					encoding: 'utf8',
					env: { ...env, HARNESS_MAC_SIGN_IDENTITY: identity }
				});
			for (const identity of [undefined, '', '-', 'Daniel']) {
				const result = run([], identity);
				expect(result.status, `Release packaging must refuse identity ${identity}`).not.toBe(0);
				expect(result.stderr, String(identity)).toContain('HARNESS_MAC_SIGN_IDENTITY');
			}
			const missingKeychain = run([], '0'.repeat(40));
			expect(missingKeychain.status).not.toBe(0);
			expect(missingKeychain.stderr).toContain('harness-signing.keychain-db');
			expect(readdirSync(join(directory, 'dist')).sort()).toEqual(['main.cjs', 'preload.cjs']);

			const artifact = join(directory, 'unsigned-harness');
			cpSync('/usr/bin/true', artifact);
			const sign = spawnSync('/usr/bin/codesign', [
				'--force',
				'--identifier',
				'dev.harness.desktop',
				'--sign',
				'-',
				artifact
			]);
			expect(sign.status, sign.stderr.toString()).toBe(0);
			const verify = run(['--verify', artifact]);
			expect(verify.status).not.toBe(0);
			expect(verify.stderr).toContain('Harness Developer ID release requirement');
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	}
);
