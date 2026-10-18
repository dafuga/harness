import { expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScenarioManifest } from '../../src/lib/contracts';
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
		const unit = JSON.parse(readFileSync(new URL(file, directory), 'utf8'));
		if (unit.kind !== 'page' || unit.status !== 'active' || !unit.preview) continue;
		const declared = JSON.parse(
			readFileSync(new URL(join('scenarios', `${unit.preview.scenario}.json`), root), 'utf8')
		);
		const state = declared.states.find((state: { id: string }) => state.id === unit.preview.state);
		expect(state?.units, `${unit.id} preview must bind its own page state`).toContain(unit.id);
	}
});
