import { test } from 'vitest';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';
import unit from '../../specification/units/function.canonical-json.json' with { type: 'json' };
import { canonicalJson } from '../../src/utils/canonicalJson';

/** JSON cannot carry these values, so each authored marker names the value its call rebuilds. */
function reconstruct(value: unknown): unknown {
	if (Array.isArray(value)) return value.map((item) => reconstruct(item));
	if (typeof value !== 'object' || value === null) return value;
	if (Object.hasOwn(value, '$fixture')) return rebuildFixture(value as Record<string, unknown>);
	return rebuildObject(value as Record<string, unknown>, {});
}

/** Defines every authored field, so accessors and hidden properties keep their real descriptors. */
function rebuildObject(fields: Record<string, unknown>, target: object): object {
	for (const [key, value] of Object.entries(fields))
		Object.defineProperty(target, key, propertyDescriptor(value));
	return target;
}

/** Getter and hidden markers stay on their property, where canonicalJson reads the descriptor. */
function propertyDescriptor(value: unknown): PropertyDescriptor {
	const marker = fixtureMarker(value);
	switch (marker.$fixture) {
		case 'getter':
			return {
				enumerable: true,
				configurable: true,
				get: () => reconstruct(marker.value)
			};
		case 'throwing-getter':
			return {
				enumerable: true,
				configurable: true,
				get() {
					throw new Error(String(marker.message));
				}
			};
		case 'hidden':
			return {
				enumerable: false,
				configurable: true,
				writable: true,
				value: reconstruct(marker.value)
			};
		default:
			return {
				enumerable: true,
				configurable: true,
				writable: true,
				value: reconstruct(value)
			};
	}
}

function fixtureMarker(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || !Object.hasOwn(value, '$fixture')) return {};
	return value as Record<string, unknown>;
}

/** Each marker kind rebuilds a non-JSON value before the public entry sees it. */
const rebuilders: Record<string, (marker: Record<string, unknown>) => unknown> = {
	undefined: () => undefined,
	bigint: (marker) => BigInt(String(marker.value)),
	date: (marker) => new Date(String(marker.value)),
	map: (marker) => new Map(marker.entries as [unknown, unknown][]),
	'null-prototype': (marker) =>
		rebuildObject(marker.fields as Record<string, unknown>, Object.create(null)),
	'symbol-keyed': (marker) =>
		rebuildObject(marker.fields as Record<string, unknown>, {
			[Symbol(String(marker.symbol))]: reconstruct(marker.value)
		}),
	'array-subclass': (marker) => class extends Array {}.of(...(marker.items as unknown[]))
};

function rebuildFixture(marker: Record<string, unknown>): unknown {
	const kind = String(marker.$fixture);
	if (!Object.hasOwn(rebuilders, kind)) throw new Error(`Unknown authored fixture ${kind}`);
	return rebuilders[kind](marker);
}

/** Calls the public canonicalJson entry with its argument rebuilt, as each displayed call states. */
function invokeCanonicalJson(...input: never[]): string {
	const [argument] = input as unknown as [unknown];
	return canonicalJson(reconstruct(argument));
}

// Each authored Example registers one case titled canonicalJson: <name>. Expected text and error
// messages come only from the fixture; the messages are V8's, which this unit runner uses.
new TestExpectationService().registerExamples(test, unit as ComponentManifest, {
	canonicalJson: invokeCanonicalJson
});
