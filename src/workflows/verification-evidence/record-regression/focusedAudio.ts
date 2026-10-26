import { fail } from '../../../core/errors';
import type { Gathered } from '../../../utils/gatherCaptures';
import type { ScenarioManifest } from '../../../core/unitTypes';
import type { FocusedContext } from './focusedScreens.types';

/** Only an authored class artifact slot can attach generated audio to an entity. */
export function focusedAudioUnit(item: Gathered, context: FocusedContext): string {
	const { unit, caseId } = audioOwner(
		audioBinding(item.capture.note),
		context,
		item.capture.sha256
	);
	if (
		!item.capture.transcript?.trim() ||
		!['fixture', 'actual-capture'].includes(item.capture.provenance ?? '') ||
		item.line.viewport !== undefined
	)
		fail(
			'Focused audio requires explicit provenance and a transcript without a screenshot viewport.'
		);
	const matches = context.scenarios.filter(
		(scenario) =>
			audioScenario(scenario, item, unit) &&
			scenario.tests.some((test) =>
				(test.cases ?? []).some((reference) => reference.unit === unit && reference.case === caseId)
			)
	);
	if (matches.length !== 1) fail('Focused audio requires one declared class case/state/slot.');
	return unit;
}

function audioOwner(binding: Record<string, unknown>, context: FocusedContext, hash: string) {
	const { unit, case: caseId, revision, sha256 } = binding;
	if (
		typeof unit !== 'string' ||
		typeof caseId !== 'string' ||
		revision !== context.commit ||
		sha256 !== hash ||
		!context.knownUnits?.includes(unit)
	)
		fail('Focused audio has a different unit, case, tested revision or media hash.');
	return { unit, caseId };
}

function audioScenario(scenario: ScenarioManifest, item: Gathered, unit: string): boolean {
	return (
		scenario.units.includes(unit) &&
		scenario.states.some(
			(state) =>
				state.id === item.line.state &&
				state.coverage === 'required' &&
				(state.units ?? scenario.units).includes(unit)
		) &&
		scenario.evidence.some(
			(evidence) =>
				evidence.id === item.line.evidence &&
				evidence.kind === 'audio' &&
				evidence.states.includes(item.line.state)
		)
	);
}

function audioBinding(note: string | undefined): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(note ?? 'null');
		if (
			parsed &&
			typeof parsed === 'object' &&
			!Array.isArray(parsed) &&
			Object.keys(parsed).sort().join(',') === 'case,revision,sha256,unit'
		)
			return parsed as Record<string, unknown>;
	} catch {
		/* Malformed bindings are refused with the same admission error. */
	}
	return fail('Focused audio requires its registered artifact binding.');
}
