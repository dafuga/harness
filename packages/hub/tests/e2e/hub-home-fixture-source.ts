import type { Page, Route } from '@playwright/test';
import type { Chat, HomeSource, HomeSourceInput } from './hub-home-fixture.types';
import { linkedComputersFixture } from './linked-computers-fixture';

/** The Hub's Home routes, and the linked computer that stands behind them when there is one. */
export async function homeSourceRoutes(page: Page, source: HomeSource, input: HomeSourceInput) {
	const sent: unknown[] = [];
	const posted: unknown[] = [];
	const linked = source === 'linked';
	if (linked)
		await linkedComputersFixture(page, input.snapshot, sent, {
			offline: false,
			held: input.held,
			present: () => input.granted() && input.available()
		});
	else
		await page.route(/\/api\/remote\/hosts\?linked=1$/, (route) =>
			route.fulfill({ json: { computers: [] } })
		);
	await page.route('**/api/hub-home', async (route) => {
		if (!linked) await input.held;
		const granted = input.granted();
		const stored = !linked && granted && input.available();
		await route.fulfill({
			json: { granted, snapshot: stored ? input.snapshot : null, controlled: [...input.controlled] }
		});
	});
	await page.route(/\/api\/hub-home\/chat(?:\?|$)/, (route) => {
		const request = route.request();
		const message = request.method() === 'POST' ? (request.postDataJSON() as Chat) : null;
		if (message) posted.push(message);
		if (!linked) return publishedChat(route, message, sent);
		// With no stored snapshot the real route queues nothing.
		const status = message ? 'refused' : 'unconfirmed';
		return route.fulfill({ json: { id: message?.id ?? chatId(request.url()), status } });
	});
	return { sent, posted };
}

const chatId = (address: string) => new URL(address).searchParams.get('id');

/** A publishing Mac's Hub queues a message, and later reports it sent. */
function publishedChat(route: Route, message: Chat | null, sent: unknown[]) {
	if (!message)
		return route.fulfill({ json: { id: chatId(route.request().url()), status: 'sent' } });
	sent.push(message);
	return route.fulfill({ status: 202, json: { id: message.id, status: 'queued' } });
}
