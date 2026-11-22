import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { HarnessApiService } from '../../src/services/networking-security/HarnessApiService';
import { apiResources, apiResource } from '../../src/workflows/networking-security/run-api/apiResources';

const state = 'filters-a-catalog-from-the-selected-snapshot';
const errorState = 'throws-expectedclierror-when-history-page-exceeds-the-limit';

test('Filters a catalog from the selected snapshot', async () => {
	const snapshot = {
		project: { id: 'demo-project' },
		revision: { branch: 'main', commit: 'b7e41d09c3a5f28e6d1904b7c3e8a25f0d6c9e1a', atTip: true },
		writable: true,
		entities: [
			{ id: 'styles.colors', category: 'styles' },
			{ id: 'reports.grid', category: 'reports' }
		]
	};
	const client = {
		hosted: false,
		options: { query: [], commit: undefined },
		snapshot: async () => snapshot
	} as unknown as HarnessApiService;
	const result = await apiResource(client, 'styles');

	expect(result).toEqual([{ id: 'styles.colors', category: 'styles' }]);
	expect(apiResources.reads).toContain('snapshot');
	recordExampleCases(
		{
			unitId: 'workflow.networking-security-run-api-api-resources',
			symbol: 'apiResource',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'styles returns only style entities from the current snapshot',
				input: { resource: 'styles', project: 'demo-project', branch: 'main' },
				output: result
			}
		]
	);
});

test('Throws ExpectedCliError when history page exceeds the limit', async () => {
	const client = {
		hosted: false,
		options: { query: ['page', '10001'], commit: undefined },
		snapshot: async () => ({
			project: { id: 'demo-project' },
			revision: { branch: 'main', commit: 'b7e41d09c3a5f28e6d1904b7c3e8a25f0d6c9e1a', atTip: true },
			writable: true,
			entities: []
		})
	} as unknown as HarnessApiService;
	let error: { name: string; message: string } | undefined;
	try {
		await apiResource(client, 'history', 'reports.component.evidence-grid');
	} catch (caught) {
		error = { name: (caught as Error).name, message: (caught as Error).message };
	}
	expect(error?.name).toBe('ExpectedCliError');
	const cases = [{
		name: 'history rejects page 10001',
		input: { resource: 'history', id: 'reports.component.evidence-grid', page: '10001' },
		error
	}];
	recordExampleCases(
		{
			unitId: 'workflow.networking-security-run-api-api-resources',
			symbol: 'apiResource',
			state: errorState,
			evidence: 'examples-cases',
			file: `${errorState}.json`
		},
		cases
	);
});
