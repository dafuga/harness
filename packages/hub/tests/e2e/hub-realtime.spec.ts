import type { Page, WebSocketRoute } from '@playwright/test';
import { expect, test } from '../../../../test/support/browserTest';
import { hubHomeFixture } from './hub-home-fixture';
import { captureNeedsYou } from './hub-home-capture';
import { clickDuringRefresh } from './hub-home-answer-motion';
import { rowOf } from './hub-home-click-through';
import { startChain } from './hub-realtime-chain';
import type { Chain } from './hub-realtime.spec.types';

test.setTimeout(180_000);

const samples = 30;
const device = 'AAAAAAAAAAAAAAAAAAAAAA';

/** Points the page's Home calls and live socket at the Hub in workerd; the socket can be cut. */
async function joinHub(page: Page, chain: Chain) {
	const link = { cut: false, sockets: [] as WebSocketRoute[], reads: 0 };
	await hubHomeFixture(page, 'default');
	await page.clock.setFixedTime(Date.now());
	await page.route(/\/api\/hub-home(\/chat)?(\?.*)?$/, async (route) => {
		const url = new URL(route.request().url());
		if (route.request().method() === 'GET' && url.pathname === '/api/hub-home') link.reads++;
		const response = await route.fetch({ url: chain.hub.origin + url.pathname + url.search });
		await route.fulfill({ response });
	});
	await page.routeWebSocket(/\/api\/sync\/v1\/live$/, (socket) => {
		if (link.cut) return void socket.close();
		link.sockets.push(socket);
		// The real browser handshake: the device id travels as a subprotocol.
		const upstream = new WebSocket(`${chain.hub.origin.replace('http', 'ws')}/api/sync/v1/live`, [
			'harness.sync.v1',
			`harness.sync.device.${device}`
		]);
		upstream.onclose = () => void socket.close().catch(() => undefined);
		const waiting: string[] = [];
		upstream.onopen = () => waiting.splice(0).forEach((text) => upstream.send(text));
		upstream.onmessage = (event) => socket.send(String(event.data));
		socket.onMessage((message) => {
			if (upstream.readyState === WebSocket.OPEN) upstream.send(String(message));
			else waiting.push(String(message));
		});
		socket.onClose(() => upstream.close());
	});
	return link;
}

const indicator = (page: Page) => page.getByRole('status', { name: 'Updates' });

/** Resolves in the page on the first frame that shows the text. */
const shows = (page: Page, text: string) =>
	page.waitForFunction((value) => document.body.innerText.includes(value), text, {
		timeout: 10_000
	});

function percentile(values: number[], share: number) {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.ceil(sorted.length * share) - 1];
}

test('a tracker change reaches an open Hub Home in under a second at p95', async ({
	page,
	context
}) => {
	const chain = await startChain();
	try {
		await joinHub(page, chain);
		const phone = await context.newPage();
		await joinHub(phone, chain);
		chain.tracker.add('fixturelive', 'Fixture realtime item');
		await Promise.all([page.goto('/'), phone.goto('/')]);
		await expect(indicator(page)).toHaveText('Live');
		await expect(indicator(phone)).toHaveText('Live');
		const latencies: number[] = [];
		for (let index = 1; index <= samples; index++) {
			const question = `Realtime question number ${index}?`;
			const started = performance.now();
			await chain.tracker.ask('fixturelive', question);
			await shows(page, question);
			latencies.push(performance.now() - started);
		}
		const result = {
			samples,
			p50: Math.round(percentile(latencies, 0.5)),
			p95: Math.round(percentile(latencies, 0.95)),
			max: Math.round(Math.max(...latencies))
		};
		console.log('hub tracker-change latency ms', JSON.stringify(result));
		await test.info().attach('latency.json', { body: JSON.stringify(result) });
		expect(result.p95).toBeLessThan(1000);
		await answerElsewhere(chain, page, phone);
	} finally {
		await chain.stop();
	}
});

/** An answer sent from one device reaches the tracker and leaves the other device's screen. */
async function answerElsewhere(chain: Chain, page: Page, phone: Page) {
	const question = `Realtime question number ${samples}?`;
	await shows(phone, question);
	const started = performance.now();
	const status = await phone.evaluate(async (question) => {
		const response = await fetch('/api/hub-home');
		const { snapshot } = await response.json();
		const agent = snapshot.agents.find(
			(entry: { question?: string }) => entry.question === question
		);
		const message = {
			id: crypto.randomUUID(),
			agentId: agent.id,
			itemId: agent.itemId,
			kind: 'answer',
			question,
			text: 'Answered on the other device'
		};
		const sent = await fetch('/api/hub-home/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(message)
		});
		return sent.status;
	}, question);
	expect(status).toBe(202);
	await page.waitForFunction((value) => !document.body.innerText.includes(value), question, {
		timeout: 10_000
	});
	const elapsed = Math.round(performance.now() - started);
	console.log('hub answer on another device ms', elapsed);
	expect(chain.tracker.answer('fixturelive')).toBe('Answered on the other device');
	expect(elapsed).toBeLessThan(2000);
}

test('a cut socket shows reconnecting and catches up on what it missed', async ({ page }) => {
	const chain = await startChain();
	try {
		const link = await joinHub(page, chain);
		chain.tracker.add('fixturelive', 'Fixture realtime item');
		await page.goto('/');
		await expect(indicator(page)).toHaveText('Live');
		await chain.tracker.ask('fixturelive', 'Before the cut?');
		await shows(page, 'Before the cut?');
		link.cut = true;
		await Promise.all(link.sockets.splice(0).map((socket) => socket.close()));
		await expect(indicator(page)).toHaveText('Reconnecting');
		const reads = link.reads;
		await chain.tracker.ask('fixturelive', 'Asked while offline?');
		await page.waitForTimeout(1500);
		await expect(page.getByText('Asked while offline?')).toHaveCount(0);
		expect(link.reads).toBe(reads);
		link.cut = false;
		await expect(indicator(page)).toHaveText('Live', { timeout: 15_000 });
		await shows(page, 'Asked while offline?');
		if (process.env.TAKE_SCREENSHOT)
			await page.screenshot({ path: test.info().outputPath('hub-live.png') });
		await page.setViewportSize({ width: 390, height: 800 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			390
		);
		if (process.env.TAKE_SCREENSHOT)
			await page.screenshot({ path: test.info().outputPath('hub-live-phone.png') });
	} finally {
		await chain.stop();
	}
});

test('a seeded Tracker decision survives a live reorder during a slow write', async ({ page }) => {
	const chain = await startChain();
	try {
		await joinHub(page, chain);
		await page.setViewportSize({ width: 390, height: 844 });
		chain.tracker.add('fixtureother', 'Other realtime item');
		const original = 'Original question on the other item?';
		await chain.tracker.ask('fixtureother', original);
		await page.goto('/');
		await expect(indicator(page)).toHaveText('Live');
		await shows(page, original);
		chain.tracker.add('fixturelive', 'Fixture realtime item');
		const question = 'Hold for the next window?';
		await chain.tracker.ask('fixturelive', question);
		const choice = rowOf(page, question).getByRole('button', { name: 'Hold', exact: true });
		await choice.scrollIntoViewIfNeeded();
		await captureNeedsYou(page, 'tracker-answer-before-phone');
		const cdp = await page.context().newCDPSession(page);
		let deliver = () => {};
		const throttled = new Promise<void>((resolve) => (deliver = resolve));
		await page.route('**/api/hub-home/chat', async (route) => {
			await throttled;
			await route.fallback();
		});
		try {
			await cdp.send('Network.emulateNetworkConditions', {
				offline: false,
				latency: 250,
				downloadThroughput: 128_000,
				uploadThroughput: 64_000
			});
			const milliseconds = await clickDuringRefresh(page, choice, async () => {
				const revised = 'Updated question on the other item?';
				await chain.tracker.ask('fixtureother', revised);
				await shows(page, revised);
				await expect(page.getByText(original, { exact: true })).toHaveCount(0);
			});
			console.log(`Hub answer feedback (seeded Tracker): ${milliseconds} ms`);
			await captureNeedsYou(page, 'tracker-answer-sending-phone');
		} finally {
			deliver();
			await cdp.detach();
		}
		await expect.poll(() => chain.tracker.answer('fixturelive')).toBe('Hold');
		await expect(rowOf(page, question)).toHaveCount(0);
	} finally {
		await chain.stop();
	}
});
