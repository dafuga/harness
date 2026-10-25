import { measureWorkload } from '../../../../test/support/measureWorkload';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import { expect, test } from 'vitest';
import { explorerAppRoute, explorerName } from '../../src/utils/explorerName';
import { unit } from '../explorerFixture';
import manifest from '../../../../test/fixtures/contract-migration/explorer-name-examples.json';

type UnitFields = NonNullable<Parameters<typeof unit>[2]>;
/** Each authored input is the id, kind and fields that the shared explorer unit fixture builds. */
type UnitInput = [id: string, kind: string, fields: UnitFields];

/**
 * JSON cannot carry undefined, so `owns: null` in an authored input builds a unit with no owned
 * source.
 */
const rebuild = ([id, kind, fields]: UnitInput) =>
	unit(id, kind, fields.owns === null ? { ...fields, owns: undefined } : fields);

/**
 * A matrix returns several names together; each one must be readable, with no path, id or file
 * ending.
 */
function readableNames(inputs: UnitInput[]): string[] {
	return inputs.map((input) => {
		const name = explorerName(rebuild(input));
		expect(name).toMatch(/^[A-Z0-9][A-Za-z0-9 ]*$/);
		return name;
	});
}

/** Every explorer name case measures the layout-catalog-behavior workload of its real call. */
const invokeExplorerName = (...input: never[]) =>
	measureWorkload('reports.function.explorer-name', 'layout-catalog-behavior', () => {
		const [first] = input as unknown[];
		return Array.isArray(first)
			? readableNames(input as unknown as UnitInput[])
			: explorerName(rebuild(input as unknown as UnitInput));
	});

const invokeExplorerAppRoute = (...input: never[]) =>
	explorerAppRoute(rebuild(input as unknown as UnitInput));

new TestExpectationService().registerExamples(test, manifest as ComponentManifest, {
	explorerName: invokeExplorerName,
	explorerAppRoute: invokeExplorerAppRoute
});
