import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../../../core/errors';
import type { RegressionRecord } from '../../../core/regressionTypes';
import type { ScenarioManifest } from '../../../core/unitTypes';
import type { CaptureLine } from '../../../core/verifyTypes';
import type { Gathered } from '../../../utils/gatherCaptures';
import type { FocusedContext } from './focusedScreens.types';
import { focusedAudioUnit } from './focusedAudio';

/** Retain decoded focused media and resolve evidence slots through their declared contracts. */
export async function focusedScreens(
	gathered: Gathered[],
	directory: string,
	context: FocusedContext
) {
	const captures: NonNullable<RegressionRecord['captures']> = [],
		files: Array<{ path: string; bytes: Buffer }> = [];
	for (const item of gathered.filter(isFocusedMedia)) {
		assertFocusedMedia(item, context.commit);
		const { line, capture } = item;
		for (const unit of retainedUnits(item, context))
			captures.push({ unit, capture, ...captureViewport(item) });
		files.push({ path: capture.path, bytes: await readFile(join(directory, line.file)) });
	}
	return { captures, files };
}

function isFocusedMedia(item: Gathered): boolean {
	return item.capture.kind === 'screenshot' || item.capture.kind === 'audio';
}

function assertFocusedMedia(item: Gathered, commit: string): void {
	const { capture, facts } = item,
		expected = capture.kind === 'audio' ? 'audio' : 'image';
	if (!facts || 'error' in facts || facts.kind !== expected)
		fail('Focused capture is not decoded media of its declared kind.');
	if (
		capture.kind === 'screenshot' &&
		capture.provenance === 'actual-capture' &&
		capture.server?.revision !== commit
	)
		fail('Focused capture has a different served revision.');
}

function retainedUnits(item: Gathered, context: FocusedContext): string[] {
	if (item.capture.kind === 'audio') return [focusedAudioUnit(item, context)];
	return captureUnits(
		item.line,
		context.scenarios,
		item.capture.provenance === 'actual-capture' ? context.knownUnits : undefined
	);
}

function captureViewport(item: Gathered) {
	const facts = item.facts;
	return facts && 'kind' in facts && facts.kind === 'image'
		? { viewport: { width: facts.width, height: facts.height } }
		: {};
}

/** An ambiguous slot never borrows another scenario's units; explicit unit identifiers still work. */
function captureUnits(
	line: CaptureLine,
	scenarios: ScenarioManifest[],
	known?: string[]
): string[] {
	const matching = scenarios.filter((scenario) =>
		scenario.evidence.some(
			(evidence) =>
				evidence.id === line.evidence &&
				evidence.kind === 'screenshot' &&
				evidence.states.includes(line.state) &&
				evidence.viewports.includes(line.viewport ?? '')
		)
	);
	const scenario = matching.length === 1 ? matching[0] : undefined;
	const units = scenario
		? (scenario.states.find((state) => state.id === line.state)?.units ?? scenario.units)
		: [line.evidence];
	const registered = new Set(known);
	if (known && (!units.length || units.some((unit) => !registered.has(unit))))
		fail('Focused capture must resolve to registered units at the tested commit.');
	return units;
}
