import { readFileSync } from 'node:fs';
import type { Page } from '../../../../../test/support/browserTest';
import type {
	HomeChatInput,
	OwnerHomeSnapshot
} from '../../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';

export const planTitle = 'Fixture release plan';
export const scheduledTitle = 'Fixture scheduled review';
export const scheduledId = 'fixture-scheduled-review';
export const canvasUrl = 'https://design.example.test/canvas';
export const imageUrl = 'https://design.example.test/plan.png';

function workSnapshot(): OwnerHomeSnapshot {
	return {
		overview: { status: 'ready', projects: [], machines: [], liveSessions: 0 },
		providers: { quota: null, routines: null },
		agents: [],
		plans: [
			{
				id: 'fixture-plan',
				title: planTitle,
				project: 'Fixture',
				state: 'draft',
				stage: 'design',
				updatedAt: new Date().toISOString(),
				total: 0,
				done: 0,
				steps: [],
				planning: {
					promotions: [],
					artifacts: {
						design: {
							summary: 'Approved fixture design',
							links: [
								{ kind: 'image', label: 'Fixture mockup', url: imageUrl },
								{ kind: 'link', label: 'Fixture design canvas', url: canvasUrl }
							]
						}
					}
				}
			}
		],
		scheduled: [
			{
				id: scheduledId,
				title: scheduledTitle,
				at: new Date(Date.now() + 86_400_000).toISOString(),
				agent: 'Fixture',
				machine: null,
				source: 'tracker',
				recurring: false,
				paused: false
			}
		]
	};
}

export async function trackerWorkFixture(page: Page, kind: 'mac' | 'iphone') {
	const messages: HomeChatInput[] = [];
	const snapshot = workSnapshot();
	await page.exposeFunction('__trackerWorkRead', () => snapshot);
	await page.exposeFunction('__trackerWorkSend', (message: HomeChatInput) => {
		messages.push(message);
		return { id: message.id, status: 'sent', messageId: 'fixture-message' };
	});
	await page.addInitScript((mode) => {
		const host = window as unknown as {
			harness: Record<string, unknown>;
			__trackerWorkRead: () => Promise<unknown>;
			__trackerWorkSend: (message: unknown) => Promise<unknown>;
			Capacitor: {
				nativePromise: (plugin: string, method: string, input: unknown) => unknown;
			};
		};
		if (mode === 'mac') {
			host.harness.hostedStatus = async () => ({
				configured: true,
				state: 'signed-in',
				actor: { id: 'google:fixture-owner', name: 'Fixture Owner' }
			});
			host.harness.homeSnapshot = host.__trackerWorkRead;
			host.harness.homeChat = host.__trackerWorkSend;
		} else {
			const native = host.Capacitor.nativePromise;
			host.Capacitor.nativePromise = async (plugin, method, input) => {
				const call = input as { method?: string; input: unknown } | undefined;
				if (plugin === 'HarnessRemote' && method === 'request') {
					if (call?.method === 'homeSnapshot') return { value: await host.__trackerWorkRead() };
					if (call?.method === 'homeChat')
						return { value: await host.__trackerWorkSend(call.input) };
				}
				return native(plugin, method, input);
			};
		}
	}, kind);
	await routePlanImage(page);
	return messages;
}

export async function routePlanImage(page: Page) {
	await page.route(imageUrl, (route) =>
		route.fulfill({
			contentType: 'image/png',
			body: readFileSync(new URL('../../../../hub/static/icons/harness-512.png', import.meta.url))
		})
	);
}
