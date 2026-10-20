import { PerformanceProfileService } from '../../src/services/PerformanceProfileService';
import { afterAll, expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScenarioManifest } from '../../src/lib/contracts';
import { componentManifestSchema } from '../../src/core/unitTypes';
import { revisionRegistry } from '../../src/utils/revision-registry/revisionRegistry';
import { previewBinding } from '../../src/utils/previewBinding';
import { registryGate } from '../../src/services/VerificationGates';
import { indexFiles, unitOf } from '../support/memoryTree';

const unit = {
	id: 'page.orders',
	scenarios: ['orders'],
	preview: { scenario: 'orders', state: 'loaded', viewport: 'desktop' }
};
const scenario: ScenarioManifest = {
	schemaVersion: 1,
	id: 'orders',
	title: 'Orders',
	kind: 'ui',
	units: [unit.id, 'page.other'],
	states: [
		{ id: 'loaded', title: 'Orders loaded', coverage: 'required', units: [unit.id] },
		{ id: 'other', title: 'Another page', coverage: 'required', units: ['page.other'] }
	],
	viewports: [{ id: 'desktop', width: 1440, height: 900 }],
	tests: [{ id: 'render', kind: 'e2e', runner: 'command', target: 'browser-test' }],
	evidence: [
		{
			id: 'screen',
			kind: 'screenshot',
			states: ['loaded', 'other'],
			viewports: ['desktop'],
			required: true
		}
	]
};

test('a preview names a declared screenshot of its own page and viewport', () => {
	expect(previewBinding(unit, [scenario])).toEqual([]);
	expect(previewBinding({ ...unit, preview: undefined }, [])).toEqual([]);
});

test('another page state, unknown scenarios and absent viewports cannot become previews', () => {
	expect(previewBinding(unit, []).join(' ')).toContain('unknown preview scenario orders');
	expect(
		previewBinding({ ...unit, preview: { ...unit.preview, state: 'other' } }, [scenario]).join(' ')
	).toContain('does not show page.orders');
	expect(
		previewBinding({ ...unit, preview: { ...unit.preview, viewport: 'phone' } }, [scenario]).join(
			' '
		)
	).toContain('no required screenshot');
});

test('a result without screenshot evidence cannot stand in for an image', () => {
	const headless = {
		...scenario,
		evidence: [{ ...scenario.evidence[0], kind: 'assertions' as const, viewports: [] }]
	};
	expect(previewBinding(unit, [headless]).join(' ')).toContain('no required screenshot');
});

test('strict verification rejects a preview that names no recorded page state', async () => {
	const source = await indexFiles({
		'src/utils/orders.ts': 'export function orders() { return []; }'
	});
	const stored = [{ ...unitOf(source, 'function.orders'), ...unit, kind: 'page' }];
	expect(registryGate({ stored: [] }, { stored, scenarios: [] }).join(' ')).toContain(
		'unknown preview scenario orders'
	);
	expect(registryGate({ stored: [] }, { stored, scenarios: [scenario] })).toEqual([]);
	expect(
		registryGate({ stored: [] }, { stored: [{ ...stored[0], status: 'retired' }], scenarios: [] })
	).toEqual([]);
});

// Exercise every committed page preview, not a synthetic manifest whose state bindings are ideal.
test('registered page previews name the state that actually shows that page', () => {
	const root = new URL('../../specification/', import.meta.url);
	const directory = new URL('units/', root);
	for (const file of readdirSync(directory)) {
		const unit = componentManifestSchema.parse(
			JSON.parse(readFileSync(new URL(file, directory), 'utf8'))
		);
		if (unit.kind !== 'page' || unit.status !== 'active' || !unit.preview) continue;
		const declared = JSON.parse(
			readFileSync(new URL(join('scenarios', `${unit.preview.scenario}.json`), root), 'utf8')
		);
		const stored = revisionRegistry([unit], [declared]).units[0];
		expect(stored, `${unit.id} preview must bind its own page state`).toHaveProperty(
			'preview',
			unit.preview
		);
	}
});

test('visual components cannot omit required preview coverage while nonvisual units can', async () => {
	const source = await indexFiles({
		'src/utils/orders.ts': 'export function orders() { return []; }'
	});
	const original = unitOf(source, 'function.orders');
	const component = { ...original, id: 'component.orders', kind: 'component', scenarios: [] };
	expect(registryGate({ stored: [] }, { stored: [component], scenarios: [] }).join(' ')).toContain(
		'component.orders: active component requires a screenshot preview'
	);
	expect(registryGate({ stored: [] }, { stored: [original], scenarios: [] })).toEqual([]);
	const covered = { ...component, scenarios: ['orders'], preview: unit.preview };
	const ownScenario = {
		...scenario,
		units: [component.id],
		states: [{ ...scenario.states[0], units: [component.id] }]
	};
	expect(registryGate({ stored: [] }, { stored: [covered], scenarios: [ownScenario] })).toEqual([]);
	expect(
		registryGate({ stored: [] }, { stored: [{ ...component, status: 'retired' }], scenarios: [] })
	).toEqual([]);
});

afterAll(async () => {
	const profiler = new PerformanceProfileService();
	await profiler.capture(
		{
			unit: 'function.preview-binding',
			workload: 'required-own-screenshot-binding',
			iterations: 1000
		},
		() => previewBinding(unit, [scenario])
	);
	const source = await indexFiles({
		'src/utils/orders.ts': 'export function orders() { return []; }'
	});
	const component = { ...unitOf(source, 'function.orders'), ...unit, kind: 'component' };
	await profiler.capture(
		{
			unit: 'service.verification-gates',
			workload: 'component-registry-preview',
			iterations: 1000
		},
		() => registryGate({ stored: [] }, { stored: [component], scenarios: [scenario] })
	);
});
