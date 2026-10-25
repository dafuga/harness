import { test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import unit from '../../../../test/fixtures/contract-migration/relay-matches-pattern-examples.json' with { type: 'json' };
import { matchesPattern } from '../../src/utils/matchesPattern';

/** JSON cannot carry undefined, so an authored example marks that argument explicitly. */
function isUndefinedMarker(value: unknown): boolean {
	return (value as { $fixture?: unknown } | null)?.$fixture === 'undefined';
}

/** Rebuilds an authored RegExp, including a position left on the pattern before the call. */
function regExpFrom(marker: unknown): RegExp {
	const { $fixture, source, flags, lastIndex } = marker as {
		$fixture?: unknown;
		source: string;
		flags: string;
		lastIndex?: number;
	};
	if ($fixture !== 'RegExp') throw new Error('Pattern must be an authored RegExp marker');
	const pattern = new RegExp(source, flags);
	if (lastIndex !== undefined) pattern.lastIndex = lastIndex;
	return pattern;
}

/**
 * Calls the public guard with the authored arguments. A repeat count makes that many calls with
 * one RegExp instance, so a global pattern keeps whatever state it has between calls.
 */
function invokeMatchesPattern(...input: never[]) {
	const [value, marker, repeats] = input as unknown as [unknown, unknown, number | undefined];
	const candidate = isUndefinedMarker(value) ? undefined : value;
	const pattern = regExpFrom(marker);
	if (repeats === undefined) return matchesPattern(candidate, pattern);
	return Array.from({ length: repeats }, () => matchesPattern(candidate, pattern));
}

new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	matchesPattern: invokeMatchesPattern
});
