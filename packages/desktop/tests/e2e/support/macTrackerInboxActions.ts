import type { TrackerPersistenceService } from '../../../../../src/services/projects-sessions/TrackerPersistenceService';
import { canvasUrl, imageUrl, planTitle, scheduledId, scheduledTitle } from './trackerWorkFixture';
import { createServer } from 'node:http';
import { _electron, expect } from '../../../../../test/support/browserTest';
import type { ElectronApplication, Page } from '../../../../../test/support/browserTest';
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

export async function redirectTracker(app: ElectronApplication, port: number) {
	await app.evaluate((_electron, port) => {
		const original = globalThis.fetch;
		globalThis.fetch = ((input, init) => {
			if (!String(input).startsWith('http://127.0.0.1:7701/')) return original(input, init);
			const url = new URL(String(input));
			url.port = String(port);
			return original(url, init);
		}) as typeof fetch;
	}, port);
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
