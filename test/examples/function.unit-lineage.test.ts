import { test } from 'vitest';
import { unitLineage } from '../../src/workflows/development-tooling/load-units/unit-index-service/unitLineage';
import type { LineageSubject } from '../../src/utils/development-tooling/unitLineage';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const subject = {
	id: 'reports.component.evidence-grid-2',
	symbols: ['EvidenceGrid', 'EvidenceGridProps', 'defaultGridColumns']
} satisfies LineageSubject;

const predecessor = (
	id: string,
	status: 'retired' | 'active',
	symbols: string[]
): ComponentManifest => ({
	schemaVersion: 1,
	id,
	uid: 'u_qk3m7wzd2a',
	kind: 'component',
	title: 'Evidence grid',
	responsibility: 'Lays captured evidence screenshots out in a fixed-column grid.',
	responsibilityOrigin: 'declared',
	status,
	owns: { source: ['src/reports/component/evidenceGrid.ts'], symbols },
	contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
	dependencies: [],
	runtime: {
		kind: 'module',
		entry: 'src/reports/component/evidenceGrid.ts',
		targets: [{ kind: 'module', entry: 'src/reports/component/evidenceGrid.ts' }]
	},
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
});

test('Finds retired predecessors by symbols or numeric id suffix', () => {
	const retired = [
		predecessor('reports.component.evidence-grid', 'retired', subject.symbols),
		predecessor('catalog.component.evidence-grid', 'retired', subject.symbols),
		predecessor('reports.component.bar-panel', 'active', subject.symbols),
		predecessor('reports.component.evidence-grid-2', 'retired', subject.symbols),
		predecessor('reports.component.evidence-grid', 'retired', ['DifferentSymbol'])
	];
	const result = unitLineage(subject, retired);
	expect(result).toEqual([
		'catalog.component.evidence-grid',
		'reports.component.evidence-grid',
		'reports.component.evidence-grid'
	]);
	recordExampleCases(
		{
			unitId: 'function.unit-lineage',
			symbol: 'unitLineage',
			state: 'finds-retired-predecessors-by-symbols-or-numeric-id-suffix',
			evidence: 'examples-cases',
			file: 'finds-retired-predecessors-by-symbols-or-numeric-id-suffix.json'
		},
		[
			{
				name: 'matches retired symbol owners and numeric predecessor while excluding active/current entries',
				input: { unit: subject, retired },
				output: result
			}
		]
	);
});
