import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const exec = promisify(execFile);
const live = process.env.HARNESS_TEST_CONTAINER_BROWSER === '1';

test.skipIf(!live)(
	'the executor withholds Chromium form content and resumes only after disposal and verification',
	{ timeout: 120_000 },
	async () => {
		const script = resolve(import.meta.dirname, 'support/containerBrowserPrivacy.ts');
		const { stdout } = await exec('bun', [script], { timeout: 110_000 });
		expect(JSON.parse(stdout.trim())).toEqual({
			before: '',
			accepted: true,
			readExecuted: false,
			after: 'ok',
			tabClosed: true,
			logCanary: false
		});
	}
);
