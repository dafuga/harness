import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

test('the CLI exposes the Vault executor lifecycle without requesting elevation', () => {
	const help = execFileSync('bun', ['run', 'src/cli/index.ts', 'vault', '--help'], {
		encoding: 'utf8'
	});
	expect(help).toMatch(/\bsetup\b/);
	expect(help).toMatch(/\bremove\b/);
	expect(help).toMatch(/\bstatus\b/);
});
