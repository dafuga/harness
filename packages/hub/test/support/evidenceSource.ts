import { createHash } from 'node:crypto';
import type { ComponentManifest, ScenarioManifest } from '../../../../src/core/unitTypes';

export const page = 'page.titles';
export const clock = 'function.clock';
const utf8 = (text: string) => new TextEncoder().encode(text);
export const json = (value: unknown) => utf8(JSON.stringify(value));
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Bytes that begin as a PNG does, and differ by what follows. */
export function png(mark: string, length = 64): Uint8Array {
	const bytes = new Uint8Array(length);
	bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
	bytes.set(utf8(mark).slice(0, length - 8), 8);
	return bytes;
}

function unit(id: string, kind: string, scenario: string): ComponentManifest {
	const entry = `src/${kind}s/${id.split('.')[1]}.ts`;
	return {
		schemaVersion: 1,
		id,
		kind,
		title: id,
		responsibility: `Does what ${id} does.`,
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [entry], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: { kind: 'module', entry, targets: [{ kind: 'module', entry }] },
		scenarios: [scenario],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

export const units = [unit(page, 'page', 'titles-page'), unit(clock, 'function', 'clock')];

export const scenarios: ScenarioManifest[] = [
	{
		schemaVersion: 1,
		id: 'titles-page',
		title: 'Titles page',
		kind: 'ui',
		units: [page],
		states: [{ id: 'default', title: 'Default', coverage: 'required' }],
		viewports: [{ id: 'desktop', width: 1280, height: 800 }],
		tests: [{ id: 'renders', kind: 'e2e', runner: 'playwright', target: 'tests/titles.spec.ts' }],
		evidence: [
			{
				id: 'screens',
				kind: 'screenshot',
				states: ['default'],
				viewports: ['desktop'],
				required: true
			}
		]
	},
	{
		schemaVersion: 1,
		id: 'clock',
		title: 'Clock',
		kind: 'headless',
		units: [clock],
		states: [{ id: 'default', title: 'Default', coverage: 'required' }],
		viewports: [],
		tests: [{ id: 'ticks', kind: 'unit', runner: 'vitest', target: 'test/clock.test.ts' }],
		evidence: [{ id: 'output', kind: 'output', states: ['default'], viewports: [], required: true }]
	}
];

/** The source tree of one commit: both units, both scenarios and what the page is at it. */
export function sourceFiles(version: string): Map<string, Uint8Array> {
	return new Map([
		...units.map((item) => [`specification/units/${item.id}.json`, json(item)] as const),
		...scenarios.map((item) => [`specification/scenarios/${item.id}.json`, json(item)] as const),
		['src/pages/titles.ts', utf8(`export const titles = '${version}';\n`)],
		['src/functions/clock.ts', utf8('export const clock = () => Date.now();\n')]
	]);
}
