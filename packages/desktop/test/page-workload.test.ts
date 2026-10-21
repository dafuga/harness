import { afterEach, expect, test, vi } from 'vitest';
import type { Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isolatedProfileCapture } from '../../../test/support/taskProfiles';
import { PerformanceEvidenceValidator } from '../../../src/validators/PerformanceEvidenceValidator';
import type { SourceFile } from '../../../src/core/sourceTypes';
import { componentManifestSchema, type ScenarioManifest } from '../../../src/core/unitTypes';
import { pageWorkload } from '../tests/e2e/page-workload';
import settings from '../../../specification/scenarios/agent-settings.json';
import declaredUnit from '../../../specification/units/desktop.page.settings.json';
const unit = componentManifestSchema.parse(declaredUnit);

const scenario = settings as ScenarioManifest;
const address = 'http://fixture.invalid/settings';
const capture = {
	state: 'settings',
	name: 'settings',
	viewport: 'desktop',
	buildId: 'protocol-fixture'
};
afterEach(() => vi.unstubAllEnvs());

/** Protocol fixture numbers are isolated and removed; they never enter task observations. */
function browser() {
	const navigation = { name: address, duration: 12.5 };
	const heap = { usedSize: 1000 };
	const session = { send: vi.fn(async () => heap), detach: vi.fn(async () => {}) };
	const context = { newCDPSession: vi.fn(async () => session) };
	const evaluate = vi.fn(async (): Promise<typeof navigation | null> => navigation);
	const page = {
		evaluate,
		url: () => address,
		context: () => context,
		viewportSize: () => ({ width: 1440, height: 900 })
	} as unknown as Page;
	return { page, evaluate, navigation, heap, session, context };
}

test('the Desktop collector names the real page module target and no unrelated scenario units', async () => {
	await isolatedProfileCapture(async (directory) => {
		const f = browser();
		await pageWorkload(f.page, scenario, capture);
		const { measurements } = JSON.parse(
			readFileSync(join(directory, 'settings-settings-desktop-benchmark.json'), 'utf8')
		);
		expect([...new Set(measurements.map((item: { unit: string }) => item.unit))]).toEqual([
			unit.id
		]);
		expect(measurements.every((item: { target: string }) => item.target === 'module')).toBe(true);
		const files = new Map<string, SourceFile>(
			unit.owns.source.map((path) => [
				path,
				{ read: true, language: 'svelte', execution: 'runtime' } as SourceFile
			])
		);
		expect(
			new PerformanceEvidenceValidator().validate({
				units: [unit],
				files,
				commit: 'a'.repeat(40),
				profile: 'protocol-fixture',
				measurements: measurements.map((item: object) => ({
					...item,
					testedRevision: 'a'.repeat(40),
					profile: 'protocol-fixture',
					artifacts: []
				}))
			})
		).toEqual([]);
		expect(f.session.detach).toHaveBeenCalledOnce();
	});
});

test.each(['other route', 'soft navigation', 'no navigation'])(
	'%s cannot borrow page timings',
	async (condition) => {
		await isolatedProfileCapture(async (directory) => {
			const f = browser();
			if (condition === 'other route') {
				f.page.url = () => address + '/other';
				f.navigation.name += '/other';
			}
			if (condition === 'soft navigation') f.navigation.name += '/previous';
			if (condition === 'no navigation') f.evaluate.mockResolvedValueOnce(null);
			await pageWorkload(f.page, scenario, capture);
			expect(existsSync(join(directory, 'captures.ndjson'))).toBe(false);
			expect(f.context.newCDPSession).not.toHaveBeenCalled();
		});
	}
);

test('a failed heap read releases its inspector and publishes no successful observation', async () => {
	await isolatedProfileCapture(async (directory) => {
		const f = browser();
		f.session.send.mockRejectedValueOnce(new Error('inspector unavailable'));
		await expect(pageWorkload(f.page, scenario, capture)).rejects.toThrow('inspector unavailable');
		expect(f.session.detach).toHaveBeenCalledOnce();
		expect(existsSync(join(directory, 'captures.ndjson'))).toBe(false);
	});
});

test.each(['duration', 'usedSize'] as const)(
	'missing %s cannot become a zero measurement',
	async (field) => {
		await isolatedProfileCapture(async (directory) => {
			const f = browser();
			if (field === 'duration') f.navigation.duration = 0;
			else f.heap.usedSize = 0;
			await expect(pageWorkload(f.page, scenario, capture)).rejects.toThrow('no positive');
			expect(existsSync(join(directory, 'captures.ndjson'))).toBe(false);
		});
	}
);
