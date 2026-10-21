import { afterEach, expect, test, vi } from 'vitest';
import type { Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isolatedProfileCapture } from '../../../test/support/taskProfiles';
import { PerformanceEvidenceValidator } from '../../../src/validators/PerformanceEvidenceValidator';
import type { SourceFile } from '../../../src/core/sourceTypes';
import { pageBenchmark, pageUnit } from '../tests/e2e/support/pageBenchmark';
import { servedBuild } from '../tests/e2e/support/harnessCapture';

vi.mock('../tests/e2e/support/harnessCapture', () => ({ servedBuild: vi.fn() }));
const commit = 'a'.repeat(40);
const unit = JSON.parse(
	readFileSync(
		new URL(
			'../../../specification/units/reports.page.harness-branch-branch-at-components.json',
			import.meta.url
		),
		'utf8'
	)
);
const address = `http://fixture.invalid/harness/branch/main/commit/${commit}/components`;

afterEach(() => {
	vi.resetAllMocks();
	vi.unstubAllEnvs();
});

/** Protocol fixtures stay inside isolatedProfileCapture and never enter task measurements. */
function browser() {
	vi.stubEnv('HARNESS_VERIFY_REVISION', commit);
	vi.mocked(servedBuild).mockResolvedValue({ buildId: 'protocol-fixture', revision: commit });
	const navigation = { name: address, duration: 12.5 };
	const heap = { usedSize: 1000 };
	const session = { send: vi.fn(async () => heap), detach: vi.fn(async () => {}) };
	const context = { newCDPSession: vi.fn(async () => session) };
	const page = {
		evaluate: vi.fn(async () => navigation),
		url: () => address,
		context: () => context,
		viewportSize: () => ({ width: 1280, height: 720 })
	} as unknown as Page;
	return { page, navigation, heap, session, context };
}

test('the browser collector satisfies the real page module contract without losing metric names', async () => {
	await isolatedProfileCapture(async (directory) => {
		const f = browser();
		await pageBenchmark(f.page, 'catalog', unit.id);
		const { measurements } = JSON.parse(
			readFileSync(join(directory, 'catalog-benchmark.json'), 'utf8')
		);
		expect(measurements.every((item: { target: string }) => item.target === 'module')).toBe(true);
		expect([...new Set(measurements.map((item: { unit: string }) => item.unit))]).toEqual([
			unit.id
		]);
		const own = measurements.filter((item: { unit: string }) => item.unit === unit.id);
		expect(own.map((item: { metric: string }) => item.metric)).toEqual([
			'browser-navigation-ms',
			'browser-js-heap-bytes'
		]);
		const files = new Map<string, SourceFile>(
			unit.owns.source.map((path: string) => [
				path,
				{ read: true, language: 'svelte', execution: 'runtime' } as SourceFile
			])
		);
		expect(
			new PerformanceEvidenceValidator().validate({
				units: [unit],
				files,
				commit,
				profile: 'protocol-fixture',
				measurements: own.map((item: object) => ({
					...item,
					testedRevision: commit,
					profile: 'protocol-fixture',
					artifacts: []
				}))
			})
		).toEqual([]);
		expect(f.session.detach).toHaveBeenCalledOnce();
	});
});

test.each([
	['components', 'reports.page.harness-branch-branch-at-components'],
	[
		'components/component.order/history',
		'reports.page.harness-branch-branch-at-components-entity-history'
	],
	['functions', 'reports.page.harness-branch-branch-at-functions'],
	['helpers/slugify/contract', 'reports.page.harness-view'],
	['helpers/slugify/examples', 'reports.page.harness-view']
])('a navigation to %s names its actual framework entry', (path, expected) => {
	expect(pageUnit(`http://fixture.invalid/harness/branch/main/commit/${commit}/${path}`)).toBe(
		expected
	);
});

test.each(['missing build', 'other revision', 'soft navigation'])(
	'%s cannot borrow document measurements',
	async (condition) => {
		await isolatedProfileCapture(async (directory) => {
			const f = browser();
			if (condition === 'missing build') vi.mocked(servedBuild).mockResolvedValue(undefined);
			if (condition === 'other revision')
				vi.mocked(servedBuild).mockResolvedValue({ buildId: 'other', revision: 'b'.repeat(40) });
			if (condition === 'soft navigation') f.navigation.name += '/previous';
			await pageBenchmark(f.page, 'catalog', unit.id);
			expect(existsSync(join(directory, 'captures.ndjson'))).toBe(false);
			expect(f.context.newCDPSession).not.toHaveBeenCalled();
		});
	}
);

test('failed heap reads release their session and cannot publish a sample', async () => {
	await isolatedProfileCapture(async (directory) => {
		const f = browser();
		f.session.send.mockRejectedValueOnce(new Error('inspector unavailable'));
		await expect(pageBenchmark(f.page, 'catalog', unit.id)).rejects.toThrow(
			'inspector unavailable'
		);
		expect(f.session.detach).toHaveBeenCalledOnce();
		expect(existsSync(join(directory, 'captures.ndjson'))).toBe(false);
	});
});

test.each(['duration', 'usedSize'] as const)(
	'an unavailable %s cannot become a measured zero',
	async (field) => {
		await isolatedProfileCapture(async (directory) => {
			const f = browser();
			if (field === 'duration') f.navigation.duration = 0;
			else f.heap.usedSize = 0;
			await expect(pageBenchmark(f.page, 'catalog', unit.id)).rejects.toThrow();
			expect(existsSync(join(directory, 'captures.ndjson'))).toBe(false);
		});
	}
);
