import { expect, test } from '../../../../test/support/browserTest';
import { webPushFixture } from './hub-web-push-fixture';
import { open, row, shot, shown } from './hub-web-push-page';

/** Where a clicked notification lands, and the real service worker that shows it. */
test.setTimeout(60000);
// The headless shell has no notification permission; the full headless Chromium does.
test.use({ channel: 'chromium' });

test('a link naming a decision opens it in Chief of Staff chat, once', async ({ page }) => {
	await webPushFixture(page, { permission: 'granted' });
	await open(page, 'desktop', '/?needs=item-harbor');
	const chat = page.getByRole('dialog', { name: 'Chief of Staff', exact: true });
	await expect(chat.getByText('Ship harbor?')).toBeVisible();
	await expect(page).toHaveURL(/\/$/);
	await shot(page, 'notification-click-ask-desktop');
});

for (const size of ['desktop', 'phone'] as const) {
	test(`the summary link lands on the needs-you list (${size})`, async ({ page }) => {
		await webPushFixture(page, { permission: 'granted' });
		await open(page, size, '/?needs=all');
		const list = page.getByRole('region', { name: /^Blocked - needs you/ });
		await expect(
			list.getByRole('button', { name: 'Talk to Chief of Staff', exact: true }).first()
		).toBeFocused();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(page).toHaveURL(/\/$/);
		await shot(page, `notification-click-list-${size}`);
	});
}

test('the service worker shows one replacing notification and a click opens the ask', async ({
	page,
	context,
	baseURL
}) => {
	const fixture = await webPushFixture(page, { permission: 'default' });
	await open(page, 'desktop');
	await row(page).getByRole('button', { name: 'Turn on notifications' }).click();
	await expect(row(page).getByRole('status')).toContainText('Notifications on');
	const devtools = await context.newCDPSession(page);
	const registration = new Promise<string>((found) =>
		devtools.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
			for (const entry of registrations) if (!entry.isDeleted) found(entry.registrationId);
		})
	);
	await devtools.send('ServiceWorker.enable');
	const registrationId = await registration;
	// What a browser hands the worker after it decrypts a push.
	const push = (data: string) =>
		devtools.send('ServiceWorker.deliverPushMessage', {
			origin: new URL(baseURL!).origin,
			registrationId,
			data
		});
	await push(JSON.stringify({ title: 'harbor needs you', body: 'Ship?', needs: 'item-harbor' }));
	await expect
		.poll(() => shown(page))
		.toEqual([
			{
				title: 'harbor needs you',
				body: 'Ship?',
				tag: 'harness-needs-you',
				data: { needs: 'item-harbor' }
			}
		]);
	await push('not json');
	await expect.poll(() => shown(page)).toMatchObject([{ title: 'A decision needs you' }]);
	await push(JSON.stringify({ title: 'harbor needs you', body: 'Ship?', needs: 'item-harbor' }));
	await expect.poll(() => shown(page)).toMatchObject([{ title: 'harbor needs you' }]);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	const [worker] = context.serviceWorkers();
	await worker.evaluate(async () => {
		const scope = self as unknown as ServiceWorkerGlobalScope;
		const [notification] = await scope.registration.getNotifications();
		const click = new NotificationEvent('notificationclick', { notification });
		scope.dispatchEvent(click);
	});
	await expect(
		page.getByRole('dialog', { name: 'Chief of Staff', exact: true }).getByText('Ship harbor?')
	).toBeVisible();
	await expect.poll(() => shown(page)).toEqual([]);
	await push(JSON.stringify({ kind: 'device-approval' }));
	await expect
		.poll(() => shown(page))
		.toEqual([
			{
				title: 'Harness',
				body: 'A device sign-in is ready for review.',
				tag: 'harness-device-approval',
				data: null
			}
		]);
	expect(fixture.writes).toHaveLength(1);
});
