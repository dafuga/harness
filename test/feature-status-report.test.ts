import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
	featureStatusReport,
	linkedUnits,
	verifiedUnitsInHistory
} from '../scripts/report-feature-status';
import { withTempDir, withTempRepo } from './support/temporary';

const metadata = (status: string, unitIds: string[] = []) =>
	`---\nstatus: ${status}\nshippedIn: null\nunitIds: ${JSON.stringify(unitIds)}\nowner: null\nreviewedAt: null\n---\n\n# Feature\n`;

test('reports stale planned docs from complete matching loops and verified linked units', async () => {
	await withTempDir('harness-feature-status-', async (root) => {
		const planned = join(root, 'specification/features/planned/agent-creation.md');
		const implemented = join(
			root,
			'packages/desktop/specification/features/implemented/finished.md'
		);
		const loop = join(root, 'specification/loops/agent-creation');
		await mkdir(join(root, 'specification/features/planned'), { recursive: true });
		await mkdir(join(root, 'packages/desktop/specification/features/implemented'), {
			recursive: true
		});
		await mkdir(loop, { recursive: true });
		await writeFile(planned, metadata('planned', ['desktop.component.agent-creation']));
		await writeFile(implemented, metadata('implemented'));
		await writeFile(
			join(loop, 'loop.json'),
			JSON.stringify({ steps: [{ status: 'complete' }, { status: 'complete' }] })
		);
		const report = featureStatusReport(root, new Set(['desktop.component.agent-creation']));
		expect(report).toMatchObject({ documents: 2, planned: 1, implemented: 1 });
		expect(report.stalePlanned).toEqual([
			{
				path: 'specification/features/planned/agent-creation.md',
				reasons: [
					'complete loop specification/loops/agent-creation',
					'verified units desktop.component.agent-creation'
				]
			}
		]);
		expect(report.missingOwnershipOrDateEvidence).toHaveLength(2);
	});
});

test('reads only explicit feature links from unit manifests', async () => {
	await withTempDir('harness-feature-units-', async (root) => {
		const units = join(root, 'specification/units');
		await mkdir(units, { recursive: true });
		await writeFile(
			join(units, 'linked.json'),
			JSON.stringify({
				id: 'reports.function.preview-owner',
				documentation: 'packages/reports/specification/features/planned/managed-preview-server.md'
			})
		);
		await writeFile(join(units, 'unlinked.json'), JSON.stringify({ id: 'reports.function.other' }));
		expect(
			linkedUnits(root).get(
				'packages/reports/specification/features/planned/managed-preview-server.md'
			)
		).toEqual(['reports.function.preview-owner']);
	});
});

test('recognizes a passed evidence-branch record as a warning signal for its unit', async () => {
	await withTempRepo(async ({ root, git }) => {
		git('checkout', '-q', '-b', 'harness-evidence');
		const record = join(root, 'records/commit/record/record.json');
		await mkdir(join(root, 'records/commit/record'), { recursive: true });
		await writeFile(
			record,
			JSON.stringify({ status: 'passed', components: [{ unit: 'unit.feature' }] })
		);
		git('add', 'records');
		git('commit', '-q', '-m', 'fixture');
		expect(verifiedUnitsInHistory(root, new Set(['unit.feature']))).toEqual(
			new Set(['unit.feature'])
		);
		expect(verifiedUnitsInHistory(root, new Set(['unit.unknown']))).toEqual(new Set());
	});
});
