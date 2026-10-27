import { readFileSync, realpathSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type {
	VisualBinding,
	VisualBindingContext,
	VisualBindingRequest,
	VisualCase,
	VisualScenario
} from './browserCaseCapture.types';

/** Resolve a runner case and screenshot name to exactly one authored evidence slot. */
export function findVisualBinding(request: VisualBindingRequest): VisualBinding {
	const scenario = readJson<VisualScenario>(request.root, 'scenarios', safeId(request.scenarioId));
	if (scenario.id !== request.scenarioId || !request.size)
		throw new Error('Visual scenario or viewport is unavailable.');
	const path = relative(realpathSync(request.root), realpathSync(request.file))
		.split(sep)
		.join('/');
	if (!path || path === '..' || path.startsWith('../'))
		throw new Error('Visual case is outside the snapshot.');
	const context: VisualBindingContext = { ...request, scenario, path, size: request.size };
	const refs = scenario.tests
		.filter((check) => check.runner === 'playwright' && sameTest(request.root, check, path))
		.flatMap((check) => check.cases ?? []);
	const matches = refs.flatMap((ref) => matchingReference(ref, context));
	if (matches.length !== 1)
		throw new Error('Visual screenshot has no unique declared case and evidence slot.');
	return matches[0];
}

function matchingReference(
	ref: { unit: string; case: string },
	context: VisualBindingContext
): VisualBinding[] {
	if (!context.scenario.units.includes(ref.unit)) return [];
	const manifest = readJson<{ id: string; testing?: { cases: VisualCase[] } }>(
		context.root,
		'units',
		safeId(ref.unit)
	);
	if (manifest.id !== ref.unit) return [];
	return (manifest.testing?.cases ?? [])
		.filter((item) => matchesCase(item, ref.case, context))
		.flatMap((item) => matchingSlots(ref.unit, item, context));
}

function matchesCase(item: VisualCase, id: string, context: VisualBindingContext): boolean {
	return (
		item.id === id &&
		item.test.file === context.path &&
		item.test.title === context.title &&
		item.expected?.kind === 'screenshot' &&
		Boolean(item.expected.file?.endsWith(`/${context.snapshot}`))
	);
}

function matchingSlots(
	unit: string,
	item: VisualCase,
	context: VisualBindingContext
): VisualBinding[] {
	return context.scenario.viewports
		.filter(
			(viewport) =>
				item.viewports?.includes(viewport.id) &&
				viewport.width === context.size.width &&
				viewport.height === context.size.height
		)
		.flatMap((viewport) =>
			context.scenario.evidence
				.filter((slot) => matchesSlot(slot, item, viewport.id, context.mode))
				.map((slot) => ({ unit, item, viewport, evidence: slot.id }))
		);
}

function matchesSlot(
	slot: VisualScenario['evidence'][number],
	item: VisualCase,
	viewport: string,
	mode: string
): boolean {
	return (
		slot.kind === 'screenshot' &&
		slot.required &&
		slot.provenance === 'actual-capture' &&
		Boolean(slot.build) &&
		slot.states.includes(item.state) &&
		slot.viewports.includes(viewport) &&
		slot.capture === mode
	);
}

function sameTest(root: string, check: { cwd?: string; target: string }, path: string): boolean {
	const target = resolve(root, check.cwd ?? '.', check.target);
	return relative(realpathSync(root), realpathSync(target)).split(sep).join('/') === path;
}

function readJson<T>(root: string, kind: 'units' | 'scenarios', id: string): T {
	return JSON.parse(readFileSync(join(root, 'specification', kind, `${id}.json`), 'utf8')) as T;
}

function safeId(value: string): string {
	if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value))
		throw new Error('Invalid visual contract identity.');
	return value;
}
