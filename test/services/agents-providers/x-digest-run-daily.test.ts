import { execFile } from 'node:child_process';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { createTempDirectory } from '../../support/temporary';

const script = resolve(import.meta.dirname, '../../../deploy/x-digest/run-daily.sh');

/** Runs the wrapper with a stand-in CLI and tracker, and returns the questions it raised. */
async function daily(output: string, status: number, ...args: string[]) {
	const directory = await createTempDirectory('x-daily-');
	const bun = join(directory, 'bun');
	const tracker = join(directory, 'tracker');
	const asked = join(directory, 'asked');
	await writeFile(bun, `#!/bin/sh\nprintf '%s\\n' '${output}'\nexit ${status}\n`);
	await writeFile(tracker, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${asked}'\n`);
	await chmod(bun, 0o700);
	await chmod(tracker, 0o700);
	await writeFile(join(directory, 'config.json'), '{ "tracker": { "item": "abc123" } }');
	await writeFile(join(directory, 'sender.json'), '{ "tracker": { "item": "abc123" } }');
	const env = {
		PATH: process.env.PATH,
		HOME: directory,
		X_DIGEST_CONF: directory,
		X_DIGEST_DATA: directory,
		X_DIGEST_BUN: bun,
		X_DIGEST_TRACKER: tracker
	};
	const code = await promisify(execFile)('bash', [script, ...args], { env }).then(
		() => 0,
		(error: { code: number }) => error.code
	);
	const questions = await readFile(asked, 'utf8').catch(() => '');
	await rm(directory, { recursive: true, force: true });
	return { code, questions };
}

test('a crash or a digest that never arrived raises one question', async () => {
	const crash = await daily('TypeError: boom', 1, 'collect');
	expect(crash).toMatchObject({ code: 1 });
	expect(crash.questions).toContain('flag abc123 X digest: the daily collect step crashed');
	const missing = await daily('{"status":"waiting"}', 1, 'send');
	expect(missing.questions).toContain('no digest arrived');
});

test('success, an already-asked status and a dry run raise nothing', async () => {
	for (const run of [
		await daily('{"status":"queued"}', 0, 'collect'),
		await daily('{"status":"signed-out"}', 1, 'collect'),
		await daily('TypeError: boom', 1, 'collect', '--dry-run')
	])
		expect(run.questions).toBe('');
});
