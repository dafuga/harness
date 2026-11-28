import { scenarioCapture } from './scenario-capture';
import scenario from '../../../../specification/scenarios/device-approval-ios-renderer.json' with { type: 'json' };
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import { captureIosAccountState } from './support/captureIosAccountState';
import { expect as baseExpect, test } from '../../../../test/support/browserTest';
import { pairedPhoneFixture } from './support/projectOverviewPairedFixture';

const expect = baseExpect.configure({ timeout: 25_000 });
test.setTimeout(90_000);
const phone = { width: 390, height: 844 };

test('an approved iPhone reviews and decides device approval requests', async ({ page }) => {
	await page.setViewportSize(phone);
	await pairedPhoneFixture(page, 'approve');
	await page.goto('/');
	const requests = page.getByRole('region', { name: 'Device approvals' });
	await expect(requests).toBeVisible();
	await expect(requests.getByText('Harness Mac')).toBeVisible();
	await expect(requests.getByText(/Portugal/)).toBeVisible();
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'inbox',
		name: 'device-approval',
		note: 'The synthetic native inbox lists a Mac and a Hub sign-in.'
	});
	await captureIosAccountState(page, 'approval-inbox');
	await requests.getByRole('button', { name: 'Review Harness Mac' }).click();
	const review = page.getByRole('dialog', { name: 'Approve Harness Mac' });
	await expect(review.getByText('053817', { exact: true })).toBeVisible();
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'compare',
		name: 'device-approval',
		note: 'The synthetic native bridge returns the comparison code.'
	});
	await captureIosAccountState(page, 'approve-review');
	await review.getByRole('button', { name: 'Approve device' }).click();
	await expect(page.getByText('Device approved.', { exact: true })).toBeVisible();
	await expect(requests.getByText('Harness Mac')).toHaveCount(0);
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'approved',
		name: 'device-approval',
		note: 'Approval is confirmed and its row has left the inbox.'
	});
	await requests.getByRole('button', { name: 'Deny Harness Hub' }).click();
	await expect(page.getByText('Device denied.', { exact: true })).toBeVisible();
	await expect(requests).toHaveCount(0);
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state: 'denied',
		name: 'device-approval',
		note: 'Denial is confirmed and the inbox no longer has requests.'
	});
});

test('the Mac renderer waits before showing the shared approval inbox', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => {
		let approved = false;
		const item = {
			id: 'a'.repeat(32),
			platform: 'iphone',
			country: 'PT',
			createdAt: Date.UTC(2026, 10, 27, 19)
		};
		const host = window as unknown as { harness: Record<string, unknown>; approveMac: () => void };
		host.approveMac = () => {
			approved = true;
			window.dispatchEvent(new Event('focus'));
		};
		host.harness = {
			hostedStatus: async () =>
				approved
					? {
							configured: true,
							state: 'signed-in',
							actor: { id: 'google:fixture-owner', name: 'Fixture Owner' }
						}
					: { configured: true, state: 'waiting-for-approval', verificationCode: '038192' },
			deviceApproval: async ({ action }: { action: string }) => {
				if (!approved) throw new Error('Mac not admitted.');
				if (action === 'list') return { requests: [item] };
				return { state: 'compare', code: '037752' };
			},
			listProjects: async () => []
		};
	});
	await page.goto('/tracker');
	await expect(page.getByText('Waiting for approval', { exact: true })).toBeVisible();
	const requests = page.getByRole('region', { name: 'Device approvals' });
	await expect(requests).toHaveCount(0);
	await page.evaluate(() => (window as unknown as { approveMac: () => void }).approveMac());
	await requests.getByRole('button', { name: 'Review Harness iPhone' }).click();
	const review = page.getByRole('dialog', { name: 'Approve Harness iPhone' });
	await expect(review.getByText('037752', { exact: true })).toBeVisible();
	await captureIosAccountState(page, 'mac-approve-review');
});
