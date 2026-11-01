import { describe, expect, test } from 'vitest';
import { measureWorkload } from '../support/measureWorkload';
import type { UnitDetail } from '../../src/cli/program/inspectUnits.types';
import { groupTests, renderContract } from '../../src/cli/program/renderUnit';
import { assertInspectionRows, assertTestAttribution } from './unitAttribution';

const field = (name: string, type: string, metadata = {}) => ({ name, type, ...metadata }) as never;
function detail(kind: string): UnitDetail {
	const entry = 'src/Badge.svelte';
	return {
		manifest: {
			id: `demo.${kind}.badge`,
			kind,
			status: 'active',
			responsibility: 'Shows a badge.',
			owns: { source: [entry] },
			runtime: { kind: 'module', entry, targets: [{ kind: 'module', entry }] },
			contract: {
				origin: 'declared',
				inputs: [
					field('Badge.status', 'Status', { required: true }),
					field('Badge.size', 'number', { required: false, default: 16 })
				],
				outputs: [field('Badge', 'markup')],
				errors: [field('ExpectedCliError', 'thrown')]
			},
			dependencies: [],
			scenarios: []
		},
		version: { unit: 'x', source: 'a'.repeat(64), contract: 'b'.repeat(64) },
		consumers: [],
		tests: ['pkg/test/a.test.ts', 'pkg/test/b.test.ts', 'pkg/test/utils/c.test.ts'],
		dependencies: []
	} as unknown as UnitDetail;
}

describe('units show rendering', () => {
	test('a component contract lists aligned props and errors, never outputs', () =>
		measureWorkload('entry.program-render-unit', 'component-contract-rendering', () => {
			const manifest = detail('component').manifest;
			manifest.contract.inputs.push(
				field('Badge.label', 'string', {
					required: false,
					description: 'Defaults to the category or Other when null.\r\nNames the action.'
				})
			);
			manifest.contract.inputs = [...manifest.contract.inputs, ...manifest.contract.inputs];
			manifest.contract.primitives = ['component.shared-primitives-card'];
			expect(renderContract(manifest)).toEqual([
				'Contract (declared)',
				'  Shared primitives',
				'    component.shared-primitives-card',
				'  Props',
				'    status  Status  (required)',
				'    size    number  (optional; default 16)',
				'    label   string  (optional)',
				'      Defaults to the category or Other when null.',
				'      Names the action.',
				'  Errors',
				'    ExpectedCliError'
			]);
		}));

	test('a function contract also lists its outputs', () => {
		expect(renderContract(detail('function').manifest)).toContain('  Outputs');
		const manifest = detail('function').manifest;
		manifest.contract.origin = 'derived';
		manifest.contract.errors = [];
		expect(renderContract(manifest)).toContain(
			'    none found (static analysis; indirect errors unknown)'
		);
	});

	test('duplicate function parameter names retain their callable owner', () => {
		const manifest = detail('function').manifest;
		manifest.contract.inputs = [
			field('serviceContract.unit', 'HarnessUnit'),
			field('modelContract.unit', 'HarnessUnit')
		];
		expect(renderContract(manifest)).toContain('    serviceContract.unit  HarnessUnit');
	});

	test('tests collapse to a count per directory', () => {
		expect(groupTests(detail('component').tests)).toEqual([
			'3 files',
			'  pkg/test/        2',
			'  pkg/test/utils/  1'
		]);
		return assertTestAttribution(detail('component'));
	});

	test('identical runtime targets and an empty lineage are not repeated', () =>
		assertInspectionRows(detail('component')));
});
