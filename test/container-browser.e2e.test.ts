import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const exec = promisify(execFile);
const live = process.env.HARNESS_TEST_CONTAINER_BROWSER === '1';

/**
 * Opt-in: needs the image from `harness container-browser setup`. It runs under Bun, as installed,
 * against a real container with its own throwaway profile.
 */
test.skipIf(!live)(
	'a real container browser is read over docker exec and publishes no port',
	{ timeout: 180_000 },
	async () => {
		const script = resolve(import.meta.dirname, 'support/containerBrowserLive.ts');
		const child = exec('bun', [script], { timeout: 170_000 });
		const { stdout } = await child;
		if (child.child.exitCode === null) await once(child.child, 'exit');
		const { policies, ...browser } = JSON.parse(stdout.trim().split('\n').at(-1)!);
		expect(browser).toEqual({
			published: '',
			screen: 'RFB 003.008',
			webdriver: false,
			headless: false,
			posts: [{ id: '12345', author: 'fixture', text: 'Hello from a fixture', likes: 1204 }],
			tab: 'clicked'
		});
		expect(policies, 'Chromium must enforce managed saving restrictions').toMatchObject([
			{ name: 'AutofillSettings', level: 'Mandatory', status: 'OK' },
			{ name: 'PasswordManagerEnabled', value: 'false', level: 'Mandatory', status: 'OK' }
		]);
		expect(JSON.parse(policies[0].value)).toEqual([
			{ url_pattern: '*', blocked_types: ['contact_info', 'payments', 'identity_docs'] }
		]);
	}
);
