import type { Page } from '@playwright/test';
import { projectFixture } from './ui-project-fixture';

/** Declared sessions, including competing assignments and a stale worker, never real model calls. */
export async function agentActivityFixture(page: Page) {
	await projectFixture(page);
	await page.addInitScript(() => {
		const host = window as unknown as {
			harness: Record<string, unknown>;
			__activityFailed: boolean;
		};
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
					units: ['component.card', 'page.home']
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
