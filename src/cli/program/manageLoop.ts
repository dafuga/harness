import type {
	CreateLoopInput,
	AddLoopStepInput,
	CompleteLoopStepInput,
	ReadLoopInput
} from './manageLoop.types';
import { resolveLoopTemplate } from '../../workflows/development-tooling/loop-templates/loopTemplates';
import {
	appendTrace,
	loopPaths,
	loopRoot,
	readLoop,
	timestamp,
	validateLoopId,
	validateRequiredText,
	writeLoop,
	writeNewLoop,
	type LoopState,
	type LoopStatus,
	type LoopStep
} from '../../workflows/development-tooling/loop-state/loopState';
import { fail } from '../../core/development-tooling/errors';
import { enforceRegressionStep } from '../../workflows/verification-evidence/record-regression/recordRegression';

export {
	type LoopEvaluator,
	type LoopState,
	type LoopStatus,
	type LoopStep
} from '../../workflows/development-tooling/loop-state/loopState';

export async function createLoop(input: CreateLoopInput): Promise<LoopStatus> {
	const root = loopRoot(input);
	const name = validateLoopId(input.name, 'Loop name');
	const goal = validateRequiredText(input.goal, 'Loop goal');
	const paths = loopPaths(root, name);
	const createdAt = timestamp(input.now);
	const state = await newLoopState(root, { name, goal, createdAt, from: input.from });

	state.agentModel = input.agentModel ?? process.env.HARNESS_AGENT_MODEL;
	await writeNewLoop(paths, state);
	await appendTrace(paths.trace, createTraceEvent(state, createdAt));

	return { state, tracePath: paths.traceRelative };
}

export async function addLoopStep(input: AddLoopStepInput): Promise<LoopStatus> {
	const loop = validateLoopId(input.loop, 'Loop name');
	const step = validateLoopId(input.step, 'Step id');
	const title = validateRequiredText(input.title, 'Step title');
	const paths = loopPaths(loopRoot(input), loop);
	const state = await readLoop(paths.state);

	if (state.steps.some((item) => item.id === step)) fail(`Loop step "${step}" already exists.`);

	const updatedAt = timestamp(input.now);
	state.steps.push({ id: step, title, status: 'pending' });
	state.updatedAt = updatedAt;

	await writeLoop(paths.state, state);
	await appendTrace(paths.trace, { event: 'step.added', timestamp: updatedAt, loop, step, title });

	return { state, tracePath: paths.traceRelative };
}

export async function completeLoopStep(input: CompleteLoopStepInput): Promise<LoopStatus> {
	const loop = validateLoopId(input.loop, 'Loop name');
	const step = validateLoopId(input.step, 'Step id');
	const evidence = validateRequiredText(input.evidence, 'Step evidence');
	const paths = loopPaths(loopRoot(input), loop);
	const state = await readLoop(paths.state);
	const item = state.steps.find((candidate) => candidate.id === step);

	if (!item) fail(`Loop step "${step}" does not exist.`);
	if (item.status === 'complete') fail(`Loop step "${step}" is already complete.`);
	const pending = state.steps.find((candidate) => candidate.status === 'pending');
	if (state.enforceOrder && pending && pending.id !== step)
		fail(`Complete loop step "${pending.id}" before "${step}".`);
	await enforceRegressionStep(loopRoot(input), state, step);

	const completedAt = timestamp(input.now);
	Object.assign(item, { status: 'complete' as const, completedAt, evidence });
	state.updatedAt = completedAt;

	await writeLoop(paths.state, state);
	await appendTrace(paths.trace, {
		event: 'step.completed',
		timestamp: completedAt,
		loop,
		step,
		evidence
	});

	return { state, tracePath: paths.traceRelative };
}

export async function readLoopStatus(input: ReadLoopInput): Promise<LoopStatus> {
	const loop = validateLoopId(input.loop, 'Loop name');
	const paths = loopPaths(loopRoot(input), loop);
	const state = await readLoop(paths.state);

	return { state, tracePath: paths.traceRelative };
}

export function renderLoopStatus(status: LoopStatus): string {
	const lines = [
		`Loop: ${status.state.name}`,
		`Goal: ${status.state.goal}`,
		`Trace: ${status.tracePath}`,
		'',
		'Steps:'
	];

	if (status.state.steps.length === 0) return [...lines, '  none'].join('\n');
	return [...lines, ...status.state.steps.flatMap(renderStep)].join('\n');
}

async function newLoopState(
	root: string,
	input: { name: string; goal: string; createdAt: string; from?: string }
): Promise<LoopState> {
	const inherited = input.from ? await resolveLoopTemplate(root, input.from) : undefined;
	return {
		name: input.name,
		goal: input.goal,
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
		template: inherited?.id,
		templateLineage: inherited?.lineage,
		enforceOrder: inherited?.lineage.some((id) =>
			['bug-fix', 'regression-prevention'].includes(id)
		),
		...(inherited?.lineage.some((id) => ['bug-fix', 'regression-prevention'].includes(id))
			? { regressionCommits: 1 as const }
			: {}),
		steps: inherited?.steps.map((step) => ({ ...step, status: 'pending' as const })) ?? [],
		evaluators: inherited?.evaluators
	};
}

function createTraceEvent(state: LoopState, timestampValue: string): Record<string, unknown> {
	return {
		event: 'loop.created',
		timestamp: timestampValue,
		name: state.name,
		goal: state.goal,
		template: state.template,
		templateLineage: state.templateLineage
	};
}

function renderStep(step: LoopStep): string[] {
	const lines = [`  [${step.status}] ${step.id} - ${step.title}`];
	if (step.evidence) lines.push(`    evidence: ${step.evidence}`);
	return lines;
}

export type {
	CreateLoopInput,
	AddLoopStepInput,
	CompleteLoopStepInput,
	ReadLoopInput
} from './manageLoop.types';
