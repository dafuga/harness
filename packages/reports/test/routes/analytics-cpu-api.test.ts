import { expect, test, vi } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import manifest from '../../../../specification/units/reports.endpoint.api-analytics-cpu.json' with { type: 'json' };

const snapshot = vi.hoisted(() => vi.fn());
vi.mock('../../../../src/services/cpu-usage-service/CpuUsageService', () => ({
	CpuUsageService: class {
		snapshot = snapshot;
	}
}));
import { GET } from '../../src/routes/api/analytics-cpu/+server';

async function responseFor(input: { url: string; snapshot?: unknown }) {
	snapshot.mockReset();
	if (input.snapshot !== undefined) snapshot.mockResolvedValue(input.snapshot);
	const response = await GET({ url: new URL(input.url) });
	if (input.snapshot === undefined) expect(snapshot).not.toHaveBeenCalled();
	return {
		statusCode: response.status,
		contentType: response.headers.get('content-type'),
		cacheControl: response.headers.get('cache-control'),
		body: await response.json()
	};
}

const cases = Object.fromEntries(
	manifest.testing.cases.map((item) => [
		item.id,
		() =>
			measureWorkload('reports.endpoint.api-analytics-cpu', 'cpu-json-response', () =>
				responseFor(item.input)
			)
	])
);
new TestExpectationService().registerCases(
	test,
	manifest as ComponentManifest,
	'packages/reports/test/routes/analytics-cpu-api.test.ts',
	cases
);
