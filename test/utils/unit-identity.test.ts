import { expect, test } from 'vitest';
import { unitIdentity } from '../../src/utils/classify-path/unitIdentity';

test('unitIdentity derives kind and name from Harness scaffold folders', () => {
	const cases: Array<[string, string]> = [
		['src/services/AnalyticsService.ts', 'service.analytics'],
		['src/utils/commandAction.ts', 'function.command-action'],
		['src/core/files.ts', 'function.files'],
		['src/audit/adapters/cpp.ts', 'audit.adapters-cpp'],
		['src/components/EvidenceGrid.svelte', 'component.evidence-grid'],
		['src/routes/+page.svelte', 'page.root'],
		['src/routes/+page.server.ts', 'page.root'],
		['src/routes/reports/[id]/+page.svelte', 'page.reports-id'],
		['src/routes/+layout.svelte', 'layout.root'],
		['src/routes/api/reports/[id]/+server.ts', 'endpoint.api-reports-id'],
		['src/lib/styles/base.css', 'style.base'],
		['src/index.ts', 'entry.index'],
		['scripts/build-picker.ts', 'script.build-picker'],
		['db/seed-data/analytics-e2e.ts', 'seeder.analytics-e2e']
	];
	for (const [path, id] of cases) expect(unitIdentity(path)?.id).toBe(id);
});

test('unitIdentity prefixes named workspaces and skips tests and unknown files', () => {
	expect(unitIdentity('src/services/ReportExportService.ts', 'reports')?.id).toBe(
		'reports.service.report-export'
	);
	expect(unitIdentity('test/services/analytics.test.ts')).toBeUndefined();
	expect(unitIdentity('README.md')).toBeUndefined();
});
