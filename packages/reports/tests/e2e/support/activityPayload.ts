import type { PayloadAgent } from './activityPayload.types';

const sha = (index: number) => index.toString(16).padStart(2, '0').repeat(20);
const iso = (at: number) => new Date(at).toISOString();
const unit = (index: number) => `service.part-${String(index).padStart(3, '0')}`;
const range = (count: number) => Array.from({ length: count }, (_, index) => index);

function agent(at: number, index: number, given: PayloadAgent) {
	const { label, state, detail = `${given.label} detail`, units = [] } = given;
	return {
		...{ id: `agent-${index}`, label, provider: 'anthropic', model: 'claude-opus-5-5' },
		...{ worktree: 'alpha-checkout', branch: 'checkout', task: 'Cart totals', loop: 'more-cart' },
		...{ units, unknownUnits: [], registeredAt: iso(at - 600_000), state, detail },
		heartbeatAt: given.heartbeatAt ?? iso(at - 5_000),
		expiresAt: given.expiresAt ?? iso(at + 895_000)
	};
}

export const manyAgents: PayloadAgent[] = [
	{ label: 'Busy agent', state: 'working', units: range(40).map(unit) },
	...range(11).map((index) => ({ label: `Helper ${index + 1}`, state: 'working' }))
];

/** The answer of `/api/project-activity` at `at`, with the given agents. */
export function activityPayload(at: number, agents: PayloadAgent[] = manyAgents) {
	const work = range(20).map((index) => ({
		...{ commit: sha(index + 1), subject: `feat: change number ${index + 1}`, author: 'Fixture' },
		...{ committedAt: iso(at - index * 3_600_000), branches: ['main'] },
		units: range(index === 0 ? 12 : 2).map(unit),
		unitCount: index === 0 ? 549 : 2,
		reasons: range(index === 0 ? 3 : 1).map((part) => ({
			unit: unit(part),
			behavior: `Reason ${part + 1} of change ${index + 1}, told in a sentence of ordinary length.`
		})),
		reasonCount: index === 0 ? 40 : 1,
		files: index === 0 ? 700 : 3
	}));
	const files = range(40).map((index) => ({
		...{ path: `src/services/Part${index}.ts`, status: 'modified', units: [unit(index)] },
		...{ commit: sha(1), committedAt: iso(at) }
	}));
	const changes = (count: number, name: string) =>
		range(count).map((index) => ({
			...{ path: `src/drafts/${name}-${index}.ts`, status: 'untracked', units: [] }
		}));
	const tree = (name: string, branch: string, count: number) => ({
		...{ name, branch, head: sha(1), primary: name === 'alpha-project' },
		...{ changes: changes(count, name), truncated: false }
	});
	const working = agents.filter((item) => item.state === 'working').length;
	return {
		activity: {
			...{ schemaVersion: 1, kind: 'live', loops: { total: 0, types: [] }, work, files },
			repository: { name: 'alpha-project', branch: 'main', head: sha(1) },
			asOf: { commit: sha(1), committedAt: iso(at) }
		},
		live: {
			sampledAt: iso(at),
			worktrees: [tree('alpha-project', 'main', 4), tree('alpha-checkout', 'checkout', 40)],
			agents: {
				...{ tracking: 'available', working, unreadable: 0 },
				roster: agents.map((item, index) => agent(at, index, item))
			}
		}
	};
}

export type { PayloadAgent } from './activityPayload.types';
