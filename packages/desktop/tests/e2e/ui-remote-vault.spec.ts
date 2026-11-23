import type { RemoteHost } from './ui-remote-host-fixture.types';
import { expect, test } from '../../../../test/support/browserTest';
import { remoteEvidence } from './remote-evidence';
import { phone, remoteHostFixture } from './ui-remote-host-fixture';

test('the Mac refreshes sanitized Vault states and directs decisions to its paired phone', async ({
	page
}, testInfo) => {
	await remoteHostFixture(page, true);
	await page.goto('/');
	await page.getByRole('button', { name: 'Phone access', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'Phone access' });
	const row = {
		requestId: 'e4'.repeat(16),
		site: 'example-console',
		action: 'read-usage',
		expiresAt: 1800000000000
	};
	const state = (entries: object[] | null, paired = true, online = true) =>
		page.evaluate(
			({ phone, entries }) => {
				const host = (window as unknown as RemoteHost).__remoteHost;
				Object.assign(host.status, { vault: { phone, requests: entries } });
			},
			{ phone: paired ? { name: phone.name, online } : null, entries }
		);

	await state([{ ...row, status: 'pending' }]);
	// Publish the first status through the same subscription used by the Electron renderer.
	await page.evaluate(() => {
		const host = (window as unknown as RemoteHost).__remoteHost;
		for (const listener of host.listeners) listener(host.copy());
	});
	const vault = panel.getByRole('region', { name: 'Vault requests' });
	const refresh = vault.getByRole('button', { name: 'Refresh Vault status' });
	await expect(vault).toContainText(
		`Open Vault requests in Harness on ${phone.name} to review with Face ID.`
	);
	await expect(vault).toContainText('example-console · read-usage · e4e4e4e4 · Waiting for iPhone');
	await remoteEvidence(page, testInfo, 'desktop-vault-pending');

	const decisions = ['approved', 'delivered', 'denied', 'expired', 'canceled'];
	await state(
		decisions.map((status, index) => ({ ...row, requestId: String(index + 1).repeat(32), status }))
	);
	await refresh.click();
	await expect(vault.getByRole('listitem')).toHaveText([
		/example-console.+Approved$/,
		/Approval delivered$/,
		/Denied$/,
		/Expired$/,
		/Canceled$/
	]);
	await expect(vault.getByRole('button')).toHaveCount(1);
	await remoteEvidence(page, testInfo, 'desktop-vault-decisions');

	await state(null, true, false);
	await refresh.click();
	await expect(vault).toContainText('Vault status is unavailable.');
	await expect(vault).toContainText(`Connect ${phone.name} to this Mac.`);
	await expect(vault.getByRole('listitem')).toHaveCount(0);
	await state(null, false);
	await refresh.click();
	await expect(vault).toContainText('The iPhone configured for Vault is no longer paired.');
});
