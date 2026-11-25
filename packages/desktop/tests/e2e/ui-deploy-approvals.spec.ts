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

async function fixture(page: Page, phone: boolean, controlled = false) {
	const original = approvalCardFixture(expiry);
	const pending = controlled ? { ...original, control: { run: original.id } } : original;
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
	if (controlled) {
		cards.push({
			...cards[0],
			project: 'preview-fixture',
			environment: 'staging',
			id: 'e349a6ba-58a7-4737-af1f-77c08d12a293',
			control: {
				run: 'e349a6ba-58a7-4737-af1f-77c08d12a293',
				preview: { blocked: true, fields: ['staging:migrations.0317'] }
			}
		});
	}
	const decisions: ApprovalDecision[] = [];
	let online = true;
	// Keep the expiry fixture stable without replacing the browser's navigation timings.
	await page.addInitScript((value) => {
		Date.now = () => value;
	}, clock);
	await page.exposeFunction('__fixtureDeploy', (input?: ApprovalDecision) => {
		if (!online) throw new Error('Synthetic authority unavailable');
		if (!input) return cards;
		decisions.push(input);
		return applyFixtureDecision(cards, input, controlled);
	});
	if (phone) await remotePhoneFixture(page, 'unpaired');
	else await installMacBridge(page);
	return {
		pending,
		deny,
		decisions,
		goOffline: () => {
			online = false;
		}
	};
}

function applyFixtureDecision(cards: ApprovalCards, input: ApprovalDecision, controlled: boolean) {
	const card = cards.find((item) => item.id === input.id && item.plan === input.plan);
	if (controlled && input.decision === 'go' && card?.receipt?.decision === 'allow') {
		Object.assign(card, {
			goAt: clock,
			progress: {
				phase: 'complete',
				operation: 'provider-operation-fixture',
				version: 'routed-fixture',
				checks: ['routed-smoke-fixture']
			}
		});
		return { id: card.id, plan: card.plan, goAt: clock };
	}
	if (!card || card.receipt || input.decision === 'go')
		throw new Error('Synthetic decision refused');
	card.receipt = {
		...input,
		decision: input.decision,
		actor: 'google-synthetic',
		receipt: '46cac0e9-4c91-4f98-a056-2ce9fe192f4c',
		decidedAt: clock
	};
	return card.receipt;
}

async function installMacBridge(page: Page) {
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
			await expect(link).toBeVisible();
			await approvalEvidence(page, info, 'entry');
			if (name === 'mobile') {
				const tracker = page.getByRole('link', { name: 'Needs you' });
				await expect(tracker).toBeVisible();
				const approvalTarget = await link.boundingBox();
				const trackerTarget = await tracker.boundingBox();
				expect(approvalTarget?.height, 'Deploy approvals tap target').toBeGreaterThanOrEqual(44);
				expect(trackerTarget?.height, 'Needs you tap target').toBeGreaterThanOrEqual(44);
			}
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
		test('start follows a distinct review and shows the exact provider receipt', async ({
			page
		}, info) => {
			const { pending, decisions } = await fixture(page, name === 'mobile', true);
			await page.goto('/deploy-approvals');
			await expect(page.getByRole('heading', { name: 'Deploy approvals' })).toBeVisible();
			await expect(page.getByRole('region', { name: 'Release decisions' })).not.toHaveAttribute(
				'aria-busy',
				'true'
			);
			await approvalEvidence(page, info, 'run-entry');
			const row = page.getByRole('button', { name: 'Review fixture preprod deploy' });
			await row.click();
			const dialog = page.getByRole('dialog', { name: 'Review deploy approval' });
			await expect(dialog.getByRole('button', { name: 'Start deploy' })).toHaveCount(0);
			await dialog.getByRole('button', { name: 'Allow deploy' }).click();
			await expect(dialog.getByRole('status')).toHaveText('Allowed');
			await approvalEvidence(page, info, 'go');
			await dialog.getByRole('button', { name: 'Start deploy' }).click({ timeout: 5000 });
			await expect(dialog.getByRole('status')).toHaveText('Complete');
			await expect(dialog.getByText('provider-operation-fixture', { exact: true })).toBeVisible();
			await expect(dialog.getByText('routed-smoke-fixture', { exact: true })).toBeVisible();
			expect(decisions).toEqual([
				{ id: pending.id, plan: pending.plan, decision: 'allow' },
				{ id: pending.id, plan: pending.plan, decision: 'go' }
			]);
			await dialog.getByText('routed-smoke-fixture', { exact: true }).scrollIntoViewIfNeeded();
			await approvalEvidence(page, info, 'run-complete');
			await dialog.getByRole('button', { name: 'Close' }).click();
			await page.getByRole('button', { name: 'Review preview-fixture staging deploy' }).click();
			await expect(dialog.getByRole('status')).toHaveText('Plan blocked by parity');
			await expect(dialog.getByRole('button', { name: /Allow|Start/ })).toHaveCount(0);
			await dialog.getByText('staging:migrations.0317', { exact: true }).scrollIntoViewIfNeeded();
			await approvalEvidence(page, info, 'run-plan');
		});
	});
}
