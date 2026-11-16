import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes.types';
import {
	compositionFindings,
	sharedPrimitiveFindings
} from '../../src/validators/development-tooling/atomicComposition';

function manifest(
	id: string,
	level: NonNullable<ComponentManifest['composition']>['level'],
	options: {
		uses?: string[];
		source?: string[];
		primitives?: string[];
		dependencies?: ComponentManifest['dependencies'];
	} = {}
): ComponentManifest {
	return {
		schemaVersion: 1,
		id,
		kind: 'component',
		title: id,
		responsibility: 'Example component for validator evidence.',
		responsibilityOrigin: 'declared',
		status: 'active',
		composition: { level, ...(options.uses ? { uses: options.uses } : {}) },
		owns: { source: options.source ?? [`src/components/${id}.svelte`], symbols: [id] },
		contract: { origin: 'declared', ...(options.primitives ? { primitives: options.primitives } : {}), inputs: [], outputs: [], errors: [] },
		dependencies: options.dependencies ?? [],
		runtime: { kind: 'module', entry: `src/components/${id}.svelte`, targets: [{ kind: 'module', entry: `src/components/${id}.svelte` }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

test('Finds illegal composition edges', () => {
	const units = [
		manifest('ui.component.icon-button', 'atom', {
			uses: ['forms.component.field-row'],
			dependencies: [{ unit: 'forms.component.field-row', via: 'import', origin: 'derived' }]
		}),
		manifest('forms.component.field-row', 'molecule')
	];
	const output = compositionFindings(units);
	expect(output).toEqual([
		'ui.component.icon-button: atom cannot compose molecule forms.component.field-row'
	]);
	recordExampleCases(
		{ unitId: 'validator.development-tooling-atomic-composition', symbol: 'compositionFindings', state: 'finds-illegal-composition-edges', evidence: 'examples-cases', file: 'finds-illegal-composition-edges.json' },
		[{ name: 'atom declares a molecule dependency', input: units, output }]
	);
});

test('Reports missing shared primitive declarations', () => {
	const units = [
		manifest('reports.component.evidence-grid', 'organism', {
			uses: ['shared-primitives.component.card'],
			dependencies: [{ unit: 'shared-primitives.component.card', via: 'import', origin: 'derived' }]
		}),
		manifest('shared-primitives.component.card', 'atom', {
			source: ['src/components/shared-primitives/Card.svelte']
		})
	];
	const output = sharedPrimitiveFindings(units);
	expect(output).toEqual([
		'reports.component.evidence-grid: contract omits shared primitive shared-primitives.component.card'
	]);
	recordExampleCases(
		{ unitId: 'validator.development-tooling-atomic-composition', symbol: 'sharedPrimitiveFindings', state: 'reports-missing-shared-primitive-declarations', evidence: 'examples-cases', file: 'reports-missing-shared-primitive-declarations.json' },
		[{ name: 'component uses a shared card without declaring it', input: units, output }]
	);
});
