import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect } from 'vitest';

/** Fresh Bun source imports and fresh Node bundle imports must expose the same supported call. */
export function assertColdEntries(
	cases: Array<{ entry: string; code: string }>,
	expected: unknown
): void {
	const directory = mkdtempSync(join(tmpdir(), 'harness-cold-entry-'));
	try {
		for (const [index, item] of cases.entries()) {
			const entry = resolve(import.meta.dirname, '../..', item.entry);
			const bundle = join(directory, `entry-${index}.mjs`);
			execFileSync(
				'bun',
				['build', entry, '--target=node', '--format=esm', `--outfile=${bundle}`],
				{ stdio: 'pipe', timeout: 20000 }
			);
			for (const [runtime, target] of [
				['bun', entry],
				['node', bundle]
			]) {
				const code = `const workspace = ${JSON.stringify(directory)}; const m = await import(${JSON.stringify(pathToFileURL(target).href)}); ${item.code}`;
				const args = runtime === 'node' ? ['--input-type=module', '-e', code] : ['-e', code];
				const actual = execFileSync(runtime, args, {
					encoding: 'utf8',
					stdio: 'pipe',
					timeout: 10000
				});
				expect(JSON.parse(actual), `${runtime}: ${item.entry}`).toEqual(expected);
			}
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
