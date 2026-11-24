import { expect, test, type Page } from '../../../../test/support/browserTest';
import { approvalCardFixture } from '../../../../test/support/scripted-deploy/approvalCardFixture';
import type {
	ApprovalCards,
	ApprovalDecision
} from '../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';
import { approvalEvidence } from './deploy-approval-evidence';
import { remotePhoneFixture } from './ui-remote-phone-fixture';

const expiry = Date.UTC(2026, 10, 24, 3, 5);
const clock = expiry - 180_000;
const viewports = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'tablet', width: 820, height: 1180 },
	{ name: 'mobile', width: 390, height: 844 }
];

async function fixture(page: Page, phone: boolean) {
	const pending = approvalCardFixture(expiry);
	const deny = {
		...pending,
		id: '35b52d67-7497-40f1-ad9a-c55e605fdb28',
		project: 'another-fixture',
		environment: 'prod' as const
	};
	const cards: ApprovalCards = [pending, deny].map((item) => ({
		...item,
		receipt: null,
		used: false
	}));
	const decisions: ApprovalDecision[] = [];
	let online = true;
	await page.clock.setFixedTime(clock);
	await page.exposeFunction('__fixtureDeploy', (input?: ApprovalDecision) => {
		if (!online) throw new Error('Synthetic authority unavailable');
		if (!input) return cards;
		decisions.push(input);
		const card = cards.find((item) => item.id === input.id && item.plan === input.plan);
		if (!card || card.receipt) throw new Error('Synthetic decision refused');
		card.receipt = {
			...input,
			actor: 'google-synthetic',
			receipt: '46cac0e9-4c91-4f98-a056-2ce9fe192f4c',
			decidedAt: clock
		};
		return card.receipt;
	});
	if (phone) await remotePhoneFixture(page, 'unpaired');
	else
		await page.addInitScript(() => {
			const host = window as unknown as {
				harness: unknown;
				__fixtureDeploy: (input?: unknown) => unknown;
			};
			host.harness = {
				hostedStatus: async () => ({
					state: 'signed-in',
					configured: true,
					actor: { id: 'google-synthetic' }
				}),
				listProjects: async () => [],
				deployApprovals: (input?: unknown) => host.__fixtureDeploy(input),
				onRunEvent: () => () => {}
			};
		});
	return {
		pending,
		deny,
		decisions,
		goOffline: () => {
			online = false;
		}
	};
}

for (const { name, width, height } of viewports) {
	test.describe(name, () => {
		test.use({ viewport: { width, height } });
		test('review records an exact online allow and deny through the native adapter', async ({
			page
		}, info) => {
			const { pending, deny, decisions, goOffline } = await fixture(page, name === 'mobile');
			await page.goto('/');
			await expect(page.getByRole('heading', { name: 'Harness', exact: true })).toBeVisible();
			const link = page.getByRole('link', { name: 'Deploy approvals' });
			await approvalEvidence(page, info, 'entry');
			await link.click({ timeout: 5000 });
			await expect(page).toHaveURL(/\/deploy-approvals$/);
			await page.goto('/deploy-approvals');
			await expect(page.getByRole('heading', { name: 'Deploy approvals' })).toBeVisible();
			await expect(
				page.getByRole('button', { name: 'Review fixture preprod deploy' })
			).toBeVisible();
			await approvalEvidence(page, info, 'pending');
			await page.getByRole('button', { name: 'Review fixture preprod deploy' }).click();
			const dialog = page.getByRole('dialog', { name: 'Review deploy approval' });
			await expect(dialog.getByText(pending.artifact!, { exact: true })).toBeVisible();
			await expect(dialog.getByText(pending.plan, { exact: true })).toBeVisible();
			await expect(dialog.getByText(pending.parity, { exact: true })).toBeVisible();
			await expect(dialog.getByText('route-health', { exact: true })).toBeVisible();
			await expect(dialog.getByText('preprod-fixture · previous-preprod')).toBeVisible();
			await expect(dialog.getByText(new Date(expiry).toISOString())).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
			await expect(dialog.getByRole('button', { name: 'Allow deploy' })).toBeInViewport();
			await approvalEvidence(page, info, 'review');
			await dialog.getByText(new Date(expiry).toISOString()).scrollIntoViewIfNeeded();
			await approvalEvidence(page, info, 'rollback-details');
			await dialog.getByRole('button', { name: 'Allow deploy' }).click();
			await expect(dialog.getByRole('status')).toHaveText('Allowed');
			await expect(dialog.getByText('google-synthetic')).toBeVisible();
			await dialog.getByText('google-synthetic').scrollIntoViewIfNeeded();
			await approvalEvidence(page, info, 'allowed');
			await dialog.getByRole('button', { name: 'Close' }).click();
			await page.getByRole('button', { name: 'Review another-fixture prod deploy' }).click();
			await dialog.getByRole('button', { name: 'Deny' }).click();
			await expect(dialog.getByRole('status')).toHaveText('Denied');
			expect(decisions).toEqual([
				{ id: pending.id, plan: pending.plan, decision: 'allow' },
				{ id: deny.id, plan: deny.plan, decision: 'deny' }
			]);
			await dialog.getByText('google-synthetic').scrollIntoViewIfNeeded();
			await approvalEvidence(page, info, 'denied');
			goOffline();
			await page.evaluate(() => window.dispatchEvent(new Event('focus')));
			await expect(page.getByRole('status')).toHaveText('Deploy approvals are unavailable.');
			await expect(dialog).toHaveCount(0);
			await approvalEvidence(page, info, 'unavailable');
		});
	});
}
