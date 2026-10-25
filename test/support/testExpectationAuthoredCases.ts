import { expect } from 'vitest';
import { componentManifestSchema, type ComponentManifest } from '../../src/core/unitTypes';
import { unitSchema } from '../../src/cli/program/inspectUnits';
import { ModuleTaskService } from '../../src/services/agents-providers/ModuleTaskService';
import { indexFiles, unitOf } from './memoryTree';
import type { TestExpectationService } from '../../src/services/verification-evidence/TestExpectationService';

/** Authored expected results survive registry parsing and both schema-export boundaries. */
export async function assertAuthoredJsonFields(service: TestExpectationService) {
	expect(() => unitSchema('ComponentManifest')).not.toThrow();
	expect(() => new ModuleTaskService().schema()).not.toThrow();
	const unit = unitOf(
		await indexFiles({
			'src/utils/echo.ts':
				'/** @pure */ export function echo(value: unknown): unknown { return value; }',
			'src/fixtureA.ts':
				'import { echo } from "./utils/echo"; export function fixtureA() { return echo(null); }',
			'src/fixtureB.ts':
				'import { echo } from "./utils/echo"; export function fixtureB() { return echo(1); }'
		}),
		'function.echo'
	);
	const raw: unknown = JSON.parse('{"__proto__":{"value":1},"nested":[{"__proto__":null}]}');
	for (const fixture of authoredUnits(unit, raw)) await assertExampleFields(service, fixture, raw);
}

function authoredUnits(unit: ComponentManifest, raw: unknown) {
	const example = { name: 'Wire fields', call: 'echo(input)', input: [raw] };
	const contract = {
		...unit.contract,
		inputs: unit.contract.inputs.map((field) => ({ ...field, examples: [raw] }))
	};
	const base = { ...unit, contract };
	return [
		{
			...base,
			helperContracts: [],
			testing: {
				...caseMatrix(),
				examples: [{ subject: 'echo', ...example, expected: { kind: 'value', value: raw } }]
			}
		},
		{
			...base,
			testing: caseMatrix(),
			helperContracts: [
				{
					name: 'echo',
					source: 'src/utils/echo.ts',
					inputs: [{ name: 'value', type: 'unknown', examples: [raw] }],
					output: 'unknown',
					pure: true,
					consumers: [{ unit: 'function.fixture-a' }, { unit: 'function.fixture-b' }],
					examples: [{ ...example, output: raw }]
				}
			]
		}
	];
}

function caseMatrix() {
	return {
		version: 1,
		shape: 'helper',
		states: ['input'],
		cases: [
			{
				id: 'wire-fields',
				state: 'input',
				subject: 'echo',
				example: 'Wire fields',
				test: { file: 'test/echo.test.ts', title: 'echo: Wire fields' }
			}
		]
	};
}

async function assertExampleFields(
	service: TestExpectationService,
	fixture: unknown,
	raw: unknown
) {
	const parsed = componentManifestSchema.parse(fixture);
	const runners: Array<() => Promise<void>> = [];
	const observed: unknown[] = [];
	service.registerExamples((_title, run) => runners.push(run), parsed, {
		echo: (value) => {
			observed.push(value);
			return value;
		}
	});
	for (const run of runners) await run();
	expect(observed, 'authored JSON data must retain every field').toEqual([raw]);
	expect(parsed.contract.inputs[0].examples).toEqual([raw]);
	if (parsed.testing?.examples)
		expect(parsed.testing.examples[0].expected).toEqual({ kind: 'value', value: raw });
	if (parsed.helperContracts?.length)
		expect(parsed.helperContracts[0].examples?.[0].output).toEqual(raw);
}
