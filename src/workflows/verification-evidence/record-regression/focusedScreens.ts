import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fail } from '../../../core/errors';
import type { RegressionRecord } from '../../../core/regressionTypes';
import type { ScenarioManifest } from '../../../core/unitTypes';
import type { CaptureLine } from '../../../core/verifyTypes';
import type { Gathered } from '../../../utils/gatherCaptures';

/** Retain inspected pixels and resolve canonical evidence slots through their scenario contract. */
export async function focusedScreens(
	gathered: Gathered[],
	directory: string,
	context: { commit: string; scenarios: ScenarioManifest[]; knownUnits?: string[] }
) {
	const captures: NonNullable<RegressionRecord['captures']> = [],
		files: Array<{ path: string; bytes: Buffer }> = [];
	for (const { line, capture, facts } of gathered.filter(
		(item) => item.capture.kind === 'screenshot'
	)) {
		if (!facts || 'error' in facts || facts.kind !== 'image')
			fail('Focused capture is not a decoded screenshot.');
		if (capture.provenance === 'actual-capture' && capture.server?.revision !== context.commit)
			fail('Focused capture has a different served revision.');
		const units = captureUnits(
			line,
			context.scenarios,
			capture.provenance === 'actual-capture' ? context.knownUnits : undefined
		);
		for (const unit of units)
			captures.push({ unit, capture, viewport: { width: facts.width, height: facts.height } });
		files.push({ path: capture.path, bytes: await readFile(join(directory, line.file)) });
	}
	return { captures, files };
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
