import type { TrackerPersistenceService } from '../../../../../src/services/projects-sessions/TrackerPersistenceService';
import { canvasUrl, imageUrl, planTitle, scheduledId, scheduledTitle } from './trackerWorkFixture';
import { createServer } from 'node:http';
import { expect } from '../../../../../test/support/browserTest';
import type { Page } from '../../../../../test/support/browserTest';
import { TrackerLocalApiService } from '../../../../../src/services/projects-sessions/TrackerLocalApiService';

export function post(api: TrackerLocalApiService, path: string, body: object) {
	return api.handle(
		new Request(`http://127.0.0.1${path}`, { method: 'POST', body: JSON.stringify(body) })
	);
}

export function serve(api: TrackerLocalApiService) {
	return createServer(async (request, response) => {
		try {
			const chunks: Buffer[] = [];
			for await (const chunk of request) chunks.push(chunk);
			const message = new Request(`http://127.0.0.1${request.url}`, {
				method: request.method,
				body: chunks.length ? Buffer.concat(chunks) : undefined
			});
			const reply = await api.handle(message);
			response.writeHead(reply.status, Object.fromEntries(reply.headers));
			response.end(await reply.text());
		} catch {
			response.writeHead(500).end();
		}
	});
}

/** Use only loopback fixture data and leave the machine's provider accounts untouched. */
export function isolateMacTrackerFixture(port: number) {
	return `{
		const child = require('node:child_process');
		const { execFile, spawn } = child;
		child.execFile = (file, args, ...rest) => file === '/usr/bin/security'
			? execFile('/usr/bin/false', [], ...rest)
			: execFile(file, args, ...rest);
		child.spawn = (command, ...args) => spawn(command === 'codex' ? '/usr/bin/false' : command, ...args);
		delete process.env.HARNESS_HUB_HOME_PROVIDER_FILE;
		const original = globalThis.fetch;
		globalThis.fetch = (input, init) => {
			const url = new URL(input instanceof Request ? input.url : String(input));
			if (url.hostname !== '127.0.0.1') return Promise.reject(new Error('Fixture fetch must use loopback.'));
			if (url.port !== '7701') return original(input, init);
			url.port = ${JSON.stringify(String(port))};
			return original(input instanceof Request ? new Request(url, input) : url, init);
		};
	}`;
}

export async function stage(page: Page, action: string, text: string) {
	await page.getByRole('button', { name: action, exact: true }).click();
	await page.getByRole('textbox').fill(text);
	await page.getByRole('button', { name: 'Review before sending' }).click();
	await expect(page.getByRole('group', { name: 'Confirm this write' })).toBeVisible();
}

export async function writeOther(page: Page, text: string) {
	await page.getByRole('button', { name: /^Other/ }).click();
	const field = page.getByRole('textbox', { name: 'Your answer' });
	await expect(field).toBeFocused();
	await field.fill(text);
}

export const confirm = (page: Page) =>
	page.getByRole('button', { name: 'Confirm and send' }).click();

export async function seedMacPlan(store: TrackerPersistenceService, api: TrackerLocalApiService) {
	const itemId = 'fixtureplan';
	store.appendLocal({
		itemId,
		fields: { kind: 'plan', title: planTitle, agent: 'Fixture', status: 'open' }
	});
	store.appendLocal({
		itemId: scheduledId,
		fields: {
			kind: 'task',
			title: scheduledTitle,
			status: 'open',
			due: new Date(Date.now() + 86_400_000).toISOString()
		}
	});
	expect(
		(
			await post(api, `/items/${itemId}/artifact`, {
				stage: 'design',
				artifact: {
					summary: 'Approved fixture design',
					links: [
						{ kind: 'image', label: 'Fixture mockup', url: imageUrl },
						{ kind: 'link', label: 'Fixture design canvas', url: canvasUrl }
					]
				}
			})
		).status
	).toBe(200);
}
