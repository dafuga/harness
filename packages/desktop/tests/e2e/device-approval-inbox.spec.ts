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
