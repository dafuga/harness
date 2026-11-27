import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { expect } from 'vitest';

export async function openHygieneBrowserFixture(root: string) {
	const profile = join(root, 'chromium');
	const context = await chromium.launchPersistentContext(profile, {
		channel: 'chromium',
		headless: true,
		args: ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0']
	});
	try {
		const endpoint = await fixtureEndpoint(profile);
		return {
			control: context,
			hygiene: (...args: string[]) => fixtureAction(root, endpoint, args),
			async targets() {
				const response = await fetch(endpoint + '/json/list');
				const targets = (await response.json()) as { id: string; url: string }[];
				return targets;
			}
		};
	} catch (error) {
		await context.close();
		throw error;
	}
}

async function fixtureEndpoint(profile: string) {
	const activePort = join(profile, 'DevToolsActivePort');
	await expect.poll(() => existsSync(activePort)).toBe(true);
	const [port, path] = readFileSync(activePort, 'utf8').split('\n');
	expect(port).toMatch(/^[0-9]+$/);
	expect(path).toMatch(/^\/devtools\/browser\/[0-9a-f-]+$/);
	const endpoint = 'http://127.0.0.1:' + port;
	const response = await fetch(endpoint + '/json/version');
	const version = (await response.json()) as { webSocketDebuggerUrl: string };
	expect(version.webSocketDebuggerUrl).toBe('ws://127.0.0.1:' + port + path);
	return endpoint;
}

function fixtureAction(root: string, endpoint: string, args: string[]) {
	const source = `
		import { join } from 'node:path';
		import { openHygieneBrowser, closeHygieneBrowser } from './src/commands/projects-sessions/tracker-hygiene-command/hygieneBrowser';
		import { readResource } from './src/commands/projects-sessions/tracker-hygiene-command/hygieneLedger';
		const [ledger, endpoint, action, resource] = Bun.argv.slice(1);
		if (action === 'close') {
			const entry = join(ledger, resource);
			const receipt = readResource(entry);
			await closeHygieneBrowser(receipt.browser, entry, receipt.target, endpoint);
			console.log(JSON.stringify({ closed: resource }));
		} else {
			console.log(JSON.stringify(await openHygieneBrowser(action, 'about:blank', endpoint)));
		}
	`;
	const ledger = join(root, 'ledger');
	return JSON.parse(
		execFileSync('bun', ['--eval', source, ledger, endpoint, ...args], {
			encoding: 'utf8',
			env: { HOME: root, PATH: process.env.PATH, HARNESS_TRACKER_HYGIENE: ledger },
			timeout: 15_000
		})
	);
}
