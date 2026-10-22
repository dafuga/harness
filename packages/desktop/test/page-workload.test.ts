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
import {
	BrowserProfileAdapter,
	type BrowserProfileInput
} from '../../../src/adapters/development-tooling/BrowserProfileAdapter';
const unit = componentManifestSchema.parse(declaredUnit);

const scenario = settings as ScenarioManifest;
const address = 'http://fixture.invalid/settings';
const capture = {
	state: 'settings',
	name: 'settings',
	viewport: 'desktop',
	buildId: 'protocol-fixture'
};

/** The requested extension is exercised against the existing collector before its repair. */
function workflowCollector(f: ReturnType<typeof browser>) {
	const surface = {
		navigation: vi.fn(async () => f.navigation),
		url: () => f.page.url(),
		heap: vi.fn(async () => f.heap.usedSize),
		viewport: () => f.page.viewportSize()!
	};
	const adapter = new BrowserProfileAdapter(surface);
	const input: BrowserProfileInput = {
		units: [unit.id],
		state: 'settings',
		workload: 'navigate-and-settle',
		file: 'workflow.json',
		buildId: 'protocol-fixture'
	};
	const capture = adapter.capture as (
		input: BrowserProfileInput,
		operation: () => Promise<void>
	) => Promise<void>;
	return {
		surface,
		run: (operation: () => Promise<void>) => capture.call(adapter, input, operation)
	};
}
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

test('a workflow runs once and never borrows the predecessor navigation measurement', async () => {
	await isolatedProfileCapture(async (directory) => {
		const f = browser();
		f.navigation.name += '/previous';
		const workflow = workflowCollector(f),
			operation = vi.fn(async () => {});
		await workflow.run(operation);
		expect(
			operation,
			'Browser workflow must execute the caller exactly once'
		).toHaveBeenCalledOnce();
		expect(workflow.surface.navigation).not.toHaveBeenCalled();
		const { measurements } = JSON.parse(readFileSync(join(directory, 'workflow.json'), 'utf8'));
		expect(measurements.map((item: { metric: string }) => item.metric)).toEqual([
			'latency-browser-workflow-ms',
			'browser-js-heap-bytes'
		]);
		expect(measurements[0].samples).toBe(1);
		expect(measurements[1].value).toBe(f.heap.usedSize);
	});
});

test('a failed workflow publishes no success and never reads the heap', async () => {
	await isolatedProfileCapture(async (directory) => {
		const workflow = workflowCollector(browser());
		await expect(
			workflow.run(async () => {
				throw Error('workflow refused');
			})
		).rejects.toThrow('workflow refused');
		expect(workflow.surface.heap).not.toHaveBeenCalled();
		expect(existsSync(join(directory, 'captures.ndjson'))).toBe(false);
	});
});

test('without evidence a browser workflow still executes once and reads no browser metrics', async () => {
	vi.stubEnv('HARNESS_EVIDENCE_DIR', '');
	vi.stubEnv('TAKE_SCREENSHOT', '');
	const workflow = workflowCollector(browser()),
		operation = vi.fn(async () => {});
	await workflow.run(operation);
	expect(operation, 'Browser workflow must execute the caller exactly once').toHaveBeenCalledOnce();
	expect(workflow.surface.navigation).not.toHaveBeenCalled();
	expect(workflow.surface.heap).not.toHaveBeenCalled();
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
