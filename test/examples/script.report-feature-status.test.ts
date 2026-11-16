import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	featureStatusReport,
	linkedUnits,
	verifiedUnitsInHistory
} from '../../scripts/report-feature-status/featureStatusReport';
import { completeLoopsFor, filesBelow } from '../../scripts/report-feature-status/featureStatusSources';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function write(root: string, path: string, content: string): void {
	const file = join(root, path);
	mkdirSync(join(file, '..'), { recursive: true });
	writeFileSync(file, content);
}

function reportFixture(root: string): void {
	write(root, 'specification/features/planned/evidence-grid.md',
		'---\nstatus: planned\nowner: team\nreviewedAt: 2026-10-30\nunitIds: ["reports.grid"]\n---\n');
	write(root, 'packages/evidence/specification/features/implemented/evidence-grid.md',
		'---\nstatus: implemented\nowner: null\nreviewedAt: null\nunitIds: ["reports.grid"]\n---\n');
	write(root, 'specification/loops/evidence-grid/loop.json', '{"steps":[{"status":"complete"}]}');
}

test('Reports stale planned documents and missing evidence', async () => {
	await withTempDir('feature-status-report-', (root) => {
		reportFixture(root);
		const output = featureStatusReport(root, new Set(['reports.grid']));
		expect(output.documents).toBe(2);
		expect(output.stalePlanned[0]?.reasons).toEqual([
			'complete loop specification/loops/evidence-grid', 'verified units reports.grid'
		]);
		const input = { root: '/example/project', verifiedUnitIds: ['reports.grid'] };
		const summary = {
			documents: output.documents, planned: output.planned, implemented: output.implemented,
			stalePlanned: output.stalePlanned,
			missingOwnershipOrDateEvidence: output.missingOwnershipOrDateEvidence
		};
		recordExampleCases({ unitId: 'script.report-feature-status', symbol: 'featureStatusReport',
			state: 'reports-stale-planned-documents-and-missing-evidence', evidence: 'examples-cases',
			file: 'reports-stale-planned-documents-and-missing-evidence.json' }, [{
			name: 'planned document with loop and verified unit', input, output: summary
		}]);
	});
});

test('Finds linked units and complete loops', async () => {
	await withTempDir('feature-status-links-', (root) => {
		reportFixture(root);
		const path = 'specification/features/planned/evidence-grid.md';
		write(root, 'specification/units/grid.json', JSON.stringify({ id: 'reports.grid', documentation: path }));
		write(root, 'specification/units/nested/copy.json', JSON.stringify({ id: 'reports.grid.extra', documentation: path }));
		const units = linkedUnits(root).get(path);
		const loops = completeLoopsFor(root, path);
		expect(units).toEqual(['reports.grid', 'reports.grid.extra']);
		expect(loops).toEqual(['specification/loops/evidence-grid']);
		recordExampleCases({ unitId: 'script.report-feature-status', symbol: 'linkedUnits',
			state: 'finds-linked-units-and-complete-loops', evidence: 'examples-cases',
			file: 'finds-linked-units-and-complete-loops.json' }, [{
			name: 'duplicate manifest links and matching loop', input: { documentation: path },
			output: { unitIds: units, loops }
		}]);
	});
});

test('Lists nested files and handles missing history', async () => {
	await withTempDir('feature-status-files-', (root) => {
		write(root, 'specification/units/a.json', '{}');
		write(root, 'specification/units/nested/b.json', '{}');
		const files = filesBelow(join(root, 'specification/units')).map((path) => path.slice(root.length + 1));
		const verified = [...verifiedUnitsInHistory(root, new Set(['reports.grid']))];
		expect(files).toEqual(['specification/units/a.json', 'specification/units/nested/b.json']);
		expect(verified).toEqual([]);
		recordExampleCases({ unitId: 'script.report-feature-status', symbol: 'filesBelow',
			state: 'lists-nested-files-and-handles-missing-history', evidence: 'examples-cases',
			file: 'lists-nested-files-and-handles-missing-history.json' }, [{
			name: 'nested files with no evidence ref', input: { directory: 'specification/units', requested: ['reports.grid'] },
			output: { files, verified }
		}]);
	});
});
