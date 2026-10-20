import type { PreviewCases } from './shared';
import { stamp } from './shared';
const check = {
	checks: 4,
	excluded: 0,
	firstTry: { numerator: 3, denominator: 4, rate: 0.75 },
	tasks: [
		{
			task: 'Component previews',
			loop: 'component-card-evidence',
			step: 'verify',
			agentModel: 'Fixture author',
			firstPassed: true,
			attempts: 1,
			attemptsToPass: 1
		}
	]
};
export const analyticsCases: PreviewCases = {
	'reports.component.analytics-cpu': {},
	'reports.component.analytics-filters': {
		filters: { loop: 'component-card-evidence', since: '2026-10-20' }
	},
	'reports.component.analytics-history': {
		summary: {
			templates: { feature: 3 },
			commands: { verify: 4 },
			evaluatorOutcomes: { passed: 4 },
			daily: { '2026-10-20': 4 }
		},
		loops: [
			{
				name: 'component-previews',
				template: 'feature',
				agentModel: 'Fixture author',
				status: 'complete',
				createdAt: stamp,
				completedAt: stamp,
				durationMs: 12000,
				evaluations: 1
			}
		]
	},
	'reports.component.analytics-models': {
		models: {
			authors: { 'Fixture author': 4 },
			loopAuthors: { 'Fixture author': 1 },
			evaluators: { 'Fixture evaluator': 4 },
			firstTryByAuthor: { 'Fixture author': { response: check, cleanCode: check } },
			inputTokens: 1200,
			outputTokens: 300
		}
	},
	'reports.component.analytics-tasks': { jev: { response: check, cleanCode: check } }
};
export const cpu = {
	status: 'available',
	sampledAt: stamp,
	logicalCores: 8,
	intervalMs: 1000,
	machinePercent: 18,
	trackedPercent: 6,
	groups: [
		{ id: 'harness', label: 'Harness', machinePercent: 4, corePercent: 32, processes: 3 },
		{ id: 'agents', label: 'Agents', machinePercent: 2, corePercent: 16, processes: 1 }
	],
	agents: [{ label: 'Preview agent', pid: 1234, processes: 1, corePercent: 16, machinePercent: 2 }]
};
