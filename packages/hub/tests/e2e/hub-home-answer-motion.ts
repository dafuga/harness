import type { WebSocketRoute } from '@playwright/test';
import { expect, test, type Locator, type Page } from '../../../../test/support/browserTest';
import { captureNeedsYou } from './hub-home-capture';
import { needsYou } from './hub-home-click-through';
import { needsYouHome, needsYouSizes } from './hub-home-fixture';

type Size = keyof typeof needsYouSizes;

export async function liveNeedsYouHome(page: Page, size: Size) {
	let socket: WebSocketRoute | undefined;
	await page.routeWebSocket('**/api/sync/v1/live', (route) => {
		socket = route;
		route.onMessage(() => route.send('pong'));
	});
	const fixture = await needsYouHome(page, size, 'two-asks', true);
	await expect(page.getByRole('status', { name: 'Updates' })).toHaveText('Live');
	return {
		...fixture,
		async refresh() {
			fixture.snapshot.agents.reverse();
			const chief = fixture.snapshot.agents.find((agent) => agent.id === 'cos');
			if (!chief?.question || !socket)
				throw new Error('Expected a live Home with a Chief of Staff ask');
			chief.question += ' Please review.';
			socket.send(JSON.stringify({ t: 'changed', topic: 'home' }));
			await expect(needsYou(page).getByText(/Please review/)).toBeVisible();
		}
	};
}

export async function recordAnswerMotion(
	page: Page,
	row: Locator,
	size: 'desktop' | 'tablet' | 'phone',
	refresh: () => Promise<void>
) {
	const choice = row.getByRole('button', { name: /Hold harbor/ });
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await choice.scrollIntoViewIfNeeded();
	await page.evaluate(() => document.fonts.ready.then(() => {}));
	let release = () => {};
	const pending = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/api/hub-home/chat', async (route) => {
		await pending;
		await route.fallback();
	});
	await captureNeedsYou(page, `answer-before-${size}`);
	const box = (await choice.boundingBox())!;
	const record = process.env.TAKE_SCREENSHOT === 'true';
	if (record)
		await page.screencast.start({
			path: test.info().outputPath(`answer-${size}.webm`),
			size: needsYouSizes[size]
		});
	try {
		const milliseconds = await clickDuringRefresh(page, choice, refresh);
		console.log(`Hub answer feedback (${size}): ${milliseconds} ms`);
		await expect(choice).toBeDisabled();
		await captureNeedsYou(page, `answer-sending-${size}`);
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		release();
		await expect(row.getByRole('status')).toContainText(/Answer sent.*Hold harbor/);
		await captureNeedsYou(page, `answer-confirmed-${size}`);
		await expect(row).toHaveCount(0);
	} finally {
		release();
		if (record) await page.screencast.stop();
	}
}

export async function clickDuringRefresh(
	page: Page,
	choice: Locator,
	refresh: () => Promise<void>
) {
	await choice.scrollIntoViewIfNeeded();
	const box = (await choice.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await refresh();
	await expect(choice).toBeFocused();
	await watchAnswerFrame(choice);
	await page.mouse.up();
	await expect(choice).toHaveAttribute('data-feedback-ms', /^\d+$/);
	const milliseconds = Number(await choice.getAttribute('data-feedback-ms'));
	expect(milliseconds).toBeLessThan(100);
	return milliseconds;
}

async function watchAnswerFrame(choice: Locator) {
	await choice.evaluate((button) => {
		window.addEventListener(
			'pointerup',
			() => {
				const start = performance.now();
				requestAnimationFrame(() => {
					const status = button.closest('li')?.querySelector('[role=status]');
					const sending = status?.textContent?.includes('Sending answer');
					button.setAttribute(
						'data-feedback-ms',
						sending && button.hasAttribute('data-chosen')
							? String(Math.round(performance.now() - start))
							: 'missing'
					);
				});
			},
			{ capture: true, once: true }
		);
	});
}
