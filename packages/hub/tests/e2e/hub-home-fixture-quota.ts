import type { HomeSubscription } from '../../../reports/src/lib/projects-sessions/hub-home/hubHome.types';
import type { MockupHomeData } from './hub-home-fixture.types';

export const homeClock = Date.parse('2026-11-21T22:30:00.000Z');
export const at = (minutes = 0) => new Date(homeClock + minutes * 60000).toISOString();

export function quotas(data: MockupHomeData): HomeSubscription[] {
	return data.quota.map((sub, index) => ({
		id: `subscription-${index}`,
		provider: sub.provider === 'Claude Code' ? 'claude' : 'codex',
		plan: sub.plan,
		account: sub.account,
		readAt: at(sub.stale ? -180 : -2),
		limits: sub.limits.map((limit, pos) => ({
			id: `limit-${pos}`,
			label: limit.label,
			left: limit.left,
			resetsAt: at(pos ? 3600 : 85)
		})),
		credits: sub.credits?.left ?? null,
		history: sub.history.map((used, pos) => ({ day: at((pos - 6) * 1440).slice(0, 10), used })),
		agents: sub.top.map(([name, usage]) => ({ name, description: `${usage}%` }))
	}));
}
