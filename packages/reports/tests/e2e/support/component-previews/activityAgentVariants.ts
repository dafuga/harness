import type { AgentEntry, AgentRoster, AgentState } from '../../../../../../src/core/activityTypes';
import type { PreviewCases } from './shared';
import { noop } from './shared';

const units = [
	'reports.component.activity-agents',
	'reports.component.activity-files',
	'reports.component.activity-loops',
	'reports.component.activity-work',
	'reports.component.project-activity',
	'reports.component.missing-preview'
];
const assignments = [
	['Capture agent', 'Capture component states'],
	['Fixture author', 'Prepare representative data'],
	['Test reviewer', 'Check responsive layouts'],
	['Contract auditor', 'Review component inputs'],
	['Browser checker', 'Inspect saved captures'],
	['Release reviewer', 'Review the evidence report']
];

/** Vary roster outcomes and disclosures while retaining the real agent input shape. */
export function activityAgentVariant(props: PreviewCases[string], variant: string) {
	const agents = props.agents as AgentRoster;
	const agent = agents.roster[0];
	if (variant === 'stale') return staleAgent(props, agents, agent);
	if (variant === 'empty-roster')
		return { ...props, agents: { ...agents, working: 0, roster: [] } };
	if (['gone', 'completed', 'failed', 'details-open'].includes(variant))
		return endedAgent(props, agents, agent, variant);
	if (variant === 'unstated')
		return {
			...props,
			agents: {
				...agents,
				roster: [
					{ ...agent, provider: null, model: null, branch: null, task: null, loop: null, units: [] }
				]
			}
		};
	if (variant === 'many-units' || variant === 'expanded-units')
		return {
			...props,
			agents: { ...agents, roster: [{ ...agent, units, unknownUnits: [units[5]] }] }
		};
	if (variant === 'many-agents' || variant === 'expanded-agents')
		return { ...props, agents: { ...agents, working: assignments.length, roster: roster(agent) } };
	return null;
}

function endedAgent(
	props: PreviewCases[string],
	agents: AgentRoster,
	agent: AgentEntry,
	variant: string
) {
	const state = (variant === 'details-open' ? 'completed' : variant) as AgentState;
	const details: Record<string, string> = {
		gone: 'The process ended before it finished.',
		completed: 'Finished capturing component previews.',
		failed: 'The preview check did not complete.'
	};
	return {
		...props,
		agents: {
			...agents,
			working: 0,
			roster: [
				{
					...agent,
					state,
					detail: details[state],
					registeredAt: '2026-10-20T09:57:00Z',
					heartbeatAt: '2026-10-20T09:59:55Z',
					...(state === 'gone' ? {} : { finishedAt: '2026-10-20T10:00:00Z' })
				}
			]
		}
	};
}

function staleAgent(props: PreviewCases[string], agents: AgentRoster, agent: AgentEntry) {
	return {
		...props,
		agents: {
			...agents,
			working: 0,
			roster: [
				{
					...agent,
					state: 'stale',
					registeredAt: '2026-10-20T09:50:00Z',
					heartbeatAt: '2026-10-20T09:54:00Z',
					expiresAt: '2026-10-20T09:59:00Z',
					detail: 'Last heartbeat is older than the allowance.'
				}
			]
		},
		reading: { now: Date.parse(props.sampledAt as string) + 61_000, failed: false, refresh: noop }
	};
}

function roster(agent: AgentEntry) {
	return assignments.map(([label, task], index) => ({
		...agent,
		id: `preview-agent-${index + 1}`,
		label,
		task,
		units: [units[index % (units.length - 1)]]
	}));
}
