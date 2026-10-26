import type { LiveActivity } from '../../../../src/core/activityTypes';
import type { ActivityHost } from './ui-agent-activity-fixture.types';
import type { Locator, Page } from '@playwright/test';
import { expect } from '../../../../test/support/browserTest';
import { projectFixture } from './ui-project-fixture';

/** Declared sessions, including competing assignments and a stale worker, never real model calls. */
export async function agentActivityFixture(page: Page) {
	await projectFixture(page);
	await page.addInitScript(() => {
		const host = window as unknown as ActivityHost;
		const card = host.__projects.data.projects[0].entities.find(
			(entity) => entity.category === 'components'
		)!;
		card.id = 'component.card';
		card.title = 'Card';
		host.harness.agentActivity = async () => {
			if (host.__activityFailed) throw new Error('Synthetic activity unavailable');
			const now = Date.now();
			const roster = [
				{
					id: 'chat-components',
					label: 'Components',
					task: 'Refine shared component previews',
					units: ['component.card']
				},
				{
					id: 'chat-pages',
					label: 'Pages',
					task: 'Review card usage on the home page',
					units: ['component.card', 'page:activity']
				},
				{
					id: 'chat-stale',
					label: 'Earlier session',
					task: 'Old assignment',
					units: ['service.missing'],
					stale: true
				}
			].map((entry) => ({
				provider: 'codex',
				model: 'gpt-6.1-sol',
				branch: 'feat/alpha',
				worktree: 'Alpha',
				loop: null,
				registeredAt: new Date(now).toISOString(),
				heartbeatAt: new Date(now).toISOString(),
				expiresAt: new Date(now + (entry.stale ? -1 : 900_000)).toISOString(),
				state: entry.stale ? 'stale' : 'working',
				detail: 'Declared by its owner',
				unknownUnits: [],
				...entry
			}));
			return {
				sampledAt: new Date(now).toISOString(),
				agents: { tracking: 'available', working: 2, unreadable: 0, roster }
			};
		};
	});
}

/** The same project fixture with enough previous sessions to exercise the compact default. */
export async function longAgentActivityFixture(page: Page) {
	await agentActivityFixture(page);
	await page.addInitScript(() => {
		const host = window as unknown as {
			harness: { agentActivity(): Promise<Pick<LiveActivity, 'sampledAt' | 'agents'>> };
		};
		const read = host.harness.agentActivity;
		host.harness.agentActivity = async () => {
			const value = await read();
			const earlier = value.agents.roster[2];
			value.agents.roster.push(
				...Array.from({ length: 12 }, (_, index) => ({
					...earlier,
					id: `old-${index}`,
					label: `Earlier session ${index}`
				}))
			);
			return value;
		};
	});
}

/** Fonts and content pixels settle before an optional acceptance screenshot. */
export async function readyForAgentCapture(page: Page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
}

/** Synthetic committed snapshots exercise both unchanged and changed queue polling. */
export async function workRefreshFixture(page: Page) {
	await page.addInitScript(() => {
		const host = window as unknown as {
			harness: Record<string, unknown>;
			__workReads: number;
			__workVersion: number;
		};
		host.__workReads = 0;
		host.__workVersion = 0;
		host.harness.projectWork = async () => {
			host.__workReads++;
			const changed = host.__workVersion > 0;
			return {
				queueCommit: (changed ? 'b' : 'a').repeat(40),
				features: [
					{ id: 'first', goal: 'First feature', tldr: '', plan: null, tasks: [] },
					{
						id: 'second',
						goal: 'Second feature',
						tldr: '',
						plan: null,
						tasks: [
							{
								id: 'second.task',
								title: 'Refresh task',
								module: 'component.card',
								status: changed ? 'accepted' : 'queued',
								dependsOn: [],
								blockedBy: [],
								belongsToPlan: false
							}
						]
					}
				]
			};
		};
	});
}

export async function verifyWorkRefresh(page: Page, panel: Locator) {
	await panel.getByRole('tab', { name: 'Work', exact: true }).click();
	const work = panel.getByRole('tabpanel', { name: 'Work', exact: true });
	const rows = work.locator('[data-harness-component="project-work"] > ul > li > details');
	await expect(rows).toHaveCount(2);
	await rows.nth(0).locator(':scope > summary').click();
	await rows.nth(1).locator(':scope > summary').click();
	await expect(rows.nth(0)).not.toHaveAttribute('open', '');
	await expect(rows.nth(1)).toHaveAttribute('open', '');
	const reads = () =>
		page.evaluate(() => (window as unknown as { __workReads: number }).__workReads);
	const before = await reads();
	await expect.poll(reads, { timeout: 9000 }).toBeGreaterThan(before);
	await expect(rows.nth(0)).not.toHaveAttribute('open', '');
	await expect(rows.nth(1)).toHaveAttribute('open', '');
	await page.evaluate(() => {
		(window as unknown as { __workVersion: number }).__workVersion = 1;
	});
	await expect(work.getByText('Accepted', { exact: true })).toBeVisible({ timeout: 9000 });
	await expect(rows.nth(0)).not.toHaveAttribute('open', '');
	await expect(rows.nth(1)).toHaveAttribute('open', '');
	await panel.getByRole('tab', { name: 'Agents', exact: true }).click();
}
