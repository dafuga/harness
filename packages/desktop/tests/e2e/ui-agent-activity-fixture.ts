import type { LiveActivity } from '../../../../src/core/activityTypes';
import type { ActivityHost } from './ui-agent-activity-fixture.types';
import type { Page } from '@playwright/test';
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
