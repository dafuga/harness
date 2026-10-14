import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test } from 'vitest';
import { cleanup, holder, owner } from './support/gatedRuns';

/**
 * A CHILD THAT FAILS IS REPORTED, NOT WAITED FOR. An owner or a gate holder that cannot be started,
 * or that ends before it is ready, rejects with how it ended; a ready owner that ends early fails
 * every status request and its return. Cleanup still ends. The processes here are real; the
 * scripts that end early are SYNTHETIC.
 */
const scratch = mkdtempSync(join(tmpdir(), 'harness-gate-children-'));
afterEach(() => cleanup(2_000), 20_000);
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

test('an owner or a holder that cannot be started rejects with the reason instead of waiting', async () => {
	const missing = join(scratch, 'no-such-program');
	await expect(owner(scratch, undefined, [missing])).rejects.toThrow(/ENOENT/);
	await expect(holder(scratch, 'never', missing)).rejects.toThrow(/ENOENT/);
});

test('an owner or a holder that ends before it is ready rejects instead of waiting', async () => {
	await expect(owner(scratch, undefined, ['bun', '-e', 'process.exit(3)'])).rejects.toThrow(
		'The process ended (exit 3) before it was ready'
	);
	await expect(holder(scratch, 'quits', 'false')).rejects.toThrow(
		'The process ended (exit 1) before it said open'
	);
});

test('a ready owner that ends early fails its pending and later status requests and its return', async () => {
	const said = JSON.stringify({
		root: join(scratch, 'early'),
		build: join(scratch, 'built', 'app')
	});
	const script = `console.log(${JSON.stringify(`ready ${said}`)}); process.stdin.once('data', () => process.exit(4));`;
	const run = await owner(scratch, undefined, ['bun', '-e', script]);
	const pending = run.status();
	await expect(pending).rejects.toThrow('The process ended (exit 4) before it answered');
	await expect(run.status()).rejects.toThrow('The process ended (exit 4) before it answered');
	await expect(run.returned).rejects.toThrow('The process ended (exit 4) before it returned');
	// Writing to a process that is gone raises nothing of its own.
	run.finish();
});
