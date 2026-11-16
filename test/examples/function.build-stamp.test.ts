import { test } from 'vitest';
import {
	buildStamp,
	buildStampPattern,
	emptyBuildStamp
} from '../../src/utils/development-tooling/buildStamp';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * Each state calls the exported functions the way their callers do: with the slot that generated
 * code holds, with no slot at all, or with emitted text that is searched for slots. What each call
 * was given and what it returned is asserted and recorded as the cases of its state. JSON has no
 * undefined, so an omitted slot is recorded as null.
 */

const marker = 'harness-build:';
const identity = '3c9f04a7d1e8b26f5a0c93e7d4b1f8a2c6e0d9b5f3a7c1e4d8b2f6a0c5e9d3b7';
const lastDigit = `${'0'.repeat(63)}1`;
const stamp = `${marker}${identity}`;
const placeholder = `${marker}${'0'.repeat(64)}`;
const lastDigitSlot = `${marker}${lastDigit}`;
const shortSlot = `${marker}${identity.slice(1)}`;
const uppercaseSlot = `${marker}${identity.toUpperCase()}`;

test('emptyBuildStamp builds the all-zero placeholder slot', () => {
	const slot = emptyBuildStamp();
	expect(slot).toBe(placeholder);
	recordExampleCases(
		{
			unitId: 'function.build-stamp',
			symbol: 'emptyBuildStamp',
			state: 'emptybuildstamp-builds-the-all-zero-placeholder-slot',
			evidence: 'examples-cases',
			file: 'emptybuildstamp-builds-the-all-zero-placeholder-slot.json'
		},
		[{ name: 'called with no arguments before any stamping', input: [], output: slot }]
	);
});

test('buildStamp reads the identity from a filled slot', () => {
	const filled = buildStamp(stamp);
	const oneDigit = buildStamp(lastDigitSlot);
	expect(filled).toBe(identity);
	expect(oneDigit).toBe(lastDigit);
	recordExampleCases(
		{
			unitId: 'function.build-stamp',
			symbol: 'buildStamp',
			state: 'buildstamp-reads-the-identity-from-a-filled-slot',
			evidence: 'examples-cases',
			file: 'buildstamp-reads-the-identity-from-a-filled-slot.json'
		},
		[
			{ name: 'a slot holding a filled 64-character identity', input: stamp, output: filled },
			{
				name: 'a slot whose only nonzero digit is the last',
				input: lastDigitSlot,
				output: oneDigit
			}
		]
	);
});

test('buildStamp treats the all-zero placeholder as unstamped', () => {
	const slot = emptyBuildStamp();
	const unstamped = buildStamp(slot);
	expect(unstamped).toBeNull();
	recordExampleCases(
		{
			unitId: 'function.build-stamp',
			symbol: 'buildStamp',
			state: 'buildstamp-treats-the-all-zero-placeholder-as-unstamped',
			evidence: 'examples-cases',
			file: 'buildstamp-treats-the-all-zero-placeholder-as-unstamped.json'
		},
		[
			{
				name: 'the placeholder emptyBuildStamp returns for an unstamped slot',
				input: slot,
				output: unstamped
			}
		]
	);
});

test('buildStamp returns null for absent or malformed slots', () => {
	const omitted = buildStamp();
	const unmarked = buildStamp(identity);
	const short = buildStamp(shortSlot);
	const uppercase = buildStamp(uppercaseSlot);
	expect(omitted).toBeNull();
	expect(unmarked).toBeNull();
	expect(short).toBeNull();
	expect(uppercase).toBeNull();
	recordExampleCases(
		{
			unitId: 'function.build-stamp',
			symbol: 'buildStamp',
			state: 'buildstamp-returns-null-for-absent-or-malformed-slots',
			evidence: 'examples-cases',
			file: 'buildstamp-returns-null-for-absent-or-malformed-slots.json'
		},
		[
			{ name: 'slot omitted, so no stamp is known', input: null, output: omitted },
			{
				name: 'a 64-character identity without the harness-build marker',
				input: identity,
				output: unmarked
			},
			{
				name: 'a remainder of 63 hexadecimal characters after the marker',
				input: shortSlot,
				output: short
			},
			{
				name: 'a remainder of 64 uppercase hexadecimal characters',
				input: uppercaseSlot,
				output: uppercase
			}
		]
	);
});

test('buildStampPattern matches filled and placeholder slots', () => {
	const emitted = `const slot = '${stamp}';\nconst fallback = '${placeholder}';`;
	const overlong = `${stamp}9f2c`;
	const found = emitted.match(buildStampPattern);
	const longer = overlong.match(buildStampPattern);
	buildStampPattern.lastIndex = 0;
	const calls = [
		buildStampPattern.test(stamp),
		buildStampPattern.test(stamp),
		buildStampPattern.test(stamp)
	];
	buildStampPattern.lastIndex = 0;
	expect(found).toEqual([stamp, placeholder]);
	expect(longer).toEqual([stamp]);
	expect(calls).toEqual([true, false, true]);
	recordExampleCases(
		{
			unitId: 'function.build-stamp',
			symbol: 'buildStampPattern',
			state: 'buildstamppattern-matches-filled-and-placeholder-slots',
			evidence: 'examples-cases',
			file: 'buildstamppattern-matches-filled-and-placeholder-slots.json'
		},
		[
			{
				name: 'emitted text with a filled slot and a placeholder slot',
				input: emitted,
				output: found
			},
			{
				name: 'a run of 68 hexadecimal characters after the marker',
				input: overlong,
				output: longer
			},
			{
				name: 'three test calls on one slot, with lastIndex kept between them',
				input: stamp,
				output: calls
			}
		]
	);
});
