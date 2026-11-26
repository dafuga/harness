import { expect, test, type Page } from '../../../../test/support/browserTest';
import { livePhoneFixture } from './ui-tracker-phone-live-fixture';
import type { LivePhoneHost } from './ui-tracker-phone-live-fixture.types';

const samples = 30;

test.use({ viewport: { width: 390, height: 844 } });

const push = (page: Page, state: 'live' | 'reconnecting', question?: string) =>
	page.evaluate(
		([next, asked]) => {
			const replica = (window as unknown as LivePhoneHost).__replica;
			replica.state = next as 'live' | 'reconnecting';
			if (asked) replica.question = asked;
			replica.emit(Boolean(asked));
		},
		[state, question ?? ''] as const
	);

/** Milliseconds, timed in the page, from a native event to the frame that shows its change. */
const rendered = (page: Page, question: string) =>
	page.evaluate(
		(asked) =>
			new Promise<number>((resolve) => {
				const replica = (window as unknown as LivePhoneHost).__replica;
				const started = performance.now();
				const look = () => {
					if (document.body.innerText.includes(asked)) resolve(performance.now() - started);
					else requestAnimationFrame(look);
				};
				replica.question = asked;
				replica.emit(true);
				look();
			}),
		question
	);

test('the open phone inbox follows native tracker pushes and says when they stop', async ({
	page
}, testInfo) => {
	await livePhoneFixture(page);
	await page.goto('/tracker');
	const indicator = page.getByRole('status', { name: 'Updates' });
	await expect(indicator).toHaveText('Reconnecting');
	await expect(page.getByText('Ship the first synthetic change?')).toBeVisible();

	await push(page, 'live');
	await expect(indicator).toHaveText('Live');
	const times: number[] = [];
	for (let index = 1; index <= samples; index++)
		times.push(await rendered(page, `Synthetic question number ${index}.`));
	times.sort((a, b) => a - b);
	const at = (share: number) => Math.round(times[Math.ceil(samples * share) - 1]);
	const latency = { samples, p50: at(0.5), p95: at(0.95), max: at(1) };
	console.log('phone native-event to render ms', JSON.stringify(latency));
	await testInfo.attach('latency.json', { body: JSON.stringify(latency) });
	expect(latency.p95).toBeLessThan(1000);

	await page.getByRole('button', { name: /Synthetic question number 30/ }).click();
	await page.getByRole('button', { name: 'Add note' }).click();
	const draft = page.getByRole('textbox', { name: 'Your text' });
	await draft.fill('Half-typed answer');
	await push(page, 'live', 'Changed while the item is open.');
	await expect(page.getByText('Changed while the item is open.')).toBeVisible({ timeout: 1000 });
	await expect(draft).toHaveValue('Half-typed answer');
	await screenshot(page, testInfo.outputPath('phone-live.png'));

	await push(page, 'reconnecting', 'Saved by the 60 s pull while pushes are down.');
	await expect(indicator).toHaveText('Reconnecting');
	await expect(page.getByText('Saved by the 60 s pull while pushes are down.')).toBeVisible({
		timeout: 1000
	});
	await expect(draft).toHaveValue('Half-typed answer');
	await screenshot(page, testInfo.outputPath('phone-reconnecting.png'));
});

async function screenshot(page: Page, path: string) {
	if (!process.env.TAKE_SCREENSHOT) return;
	await page.screenshot({ path, fullPage: true });
}
