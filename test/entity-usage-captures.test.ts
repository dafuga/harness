import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { scenarioManifestSchema } from '../src/core/unitTypes';
import { defaultUnitsConfig } from '../src/core/unitsConfig';
import { captureIndex, defaultVerifyConfig } from '../src/core/verifyTypes';
import { gatherCaptures } from '../src/utils/gatherCaptures';
import { scenarioCoverage } from '../src/utils/scenarioCoverage';
import { scenarioRequirements } from '../src/utils/scenarioRequirements';
import { verifyPlan } from '../src/utils/verifyPlan';
import { syntheticPng as png } from './support/syntheticPng';
import { verificationTarget } from './verification-targets';

/**
 * USED IN AND USES ARE PROVEN BY PICTURES OF THE RUNNING RENDERER. A verification has to run
 * both workspace specs through the scenario wrapper and accept nothing less than a fresh,
 * stamped screenshot of every surface. This holds the real plan, the real requirements and the
 * real coverage gate to that; the PNG files written here are SYNTHETIC inputs of the gate only.
 */
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown;
const scenario = scenarioManifestSchema.parse(
	read('specification/scenarios/desktop-renderer.json')
);
const specs = ['ui-entity-usage', 'ui-entity-usage-viewports'].map(
	(name) => `tests/e2e/${name}.spec.ts`
);
const needs = [
	...['overview', 'used-in', 'uses', 'former-address', 'nothing-recorded'].map((state) => [
		'usage-screens-desktop',
		`usage-${state}`,
		'desktop'
	]),
	['usage-screens-tablet', 'usage-overview', 'tablet'],
	['usage-screens-mobile', 'usage-overview', 'mobile']
];
const commit = 'c'.repeat(40);
const build = 'b'.repeat(64);
const folders: string[] = [];
afterAll(() => folders.forEach((folder) => rmSync(folder, { recursive: true, force: true })));

interface Change {
	omit?: string;
	revision?: string;
	buildId?: string;
	unwritten?: string;
	width?: number;
	failed?: boolean;
}
/** What the gate says of the usage captures a run left, with one thing about them changed. */
function judged(change: Change = {}) {
	const folder = mkdtempSync(join(tmpdir(), 'harness-usage-captures-'));
	folders.push(folder);
	const lines = needs.flatMap(([evidence, state, viewport]) => {
		const size = scenario.viewports.find((item) => item.id === viewport) ?? { width: 0, height: 0 };
		const file = `ui-${state}-${viewport}.png`;
		if (state === change.omit) return [];
		const width = viewport === 'tablet' ? (change.width ?? size.width) : size.width;
		if (state !== change.unwritten)
			writeFileSync(join(folder, file), png(width, size.height + 300));
		const server = { buildId: change.buildId ?? build, revision: change.revision ?? commit };
		const made = {
			kind: 'screenshot',
			mediaType: 'image/png',
			provenance: 'actual-capture',
			server
		};
		return [JSON.stringify({ evidence, state, viewport, file, ...made })];
	});
	writeFileSync(join(folder, captureIndex), `${lines.join('\n')}\n`);
	const { gathered, failures } = gatherCaptures(folder, 'evidence');
	const builds = {
		declared: ['desktop-renderer'],
		compiled: new Map([['desktop-renderer', build]])
	};
	const result = scenarioCoverage({
		scenario,
		commit,
		gathered,
		checkFailed: change.failed ?? false,
		builds
	});
	const usage = result.failures.filter((failure) => failure.includes('usage-'));
	const states = result.states.filter((state) => state.id.startsWith('usage-'));
	return {
		usage,
		gather: failures,
		statuses: states.map((state) => state.captures.map((item) => item.status))
	};
}

test('a clean verification runs both usage specs through the scenario wrapper', () => {
	const plan = verifyPlan({
		selectedTests: [],
		scenarios: [scenario],
		config: defaultVerifyConfig,
		unitsConfig: defaultUnitsConfig
	});
	for (const file of specs) {
		const command = `bun ../../test/verification-output.ts playwright ${file}`;
		const checks = plan.filter(
			(check) => check.scenario === scenario.id && check.command === command
		);
		expect(checks.map((check) => [check.runner, check.cwd])).toEqual([
			['command', 'packages/desktop']
		]);
		const target = verificationTarget(scenario.id, 'playwright', file, resolve('packages/desktop'));
		expect(target.states).toEqual(['entity-usage']);
	}
	const output = scenarioRequirements(scenario).required.filter(
		(need) => need.state === 'entity-usage'
	);
	expect(output.map((need) => [need.evidence, need.kind])).toEqual([
		['desktop-renderer-output', 'output']
	]);
});

test('the scenario requires every Used In and Uses surface at the widths the specs set', () => {
	const required = scenarioRequirements(scenario).required.filter((need) =>
		need.state.startsWith('usage-')
	);
	expect(required.map((need) => [need.evidence, need.state, need.viewport])).toEqual(needs);
	const pictures = scenario.evidence.filter((item) => item.id.startsWith('usage-screens-'));
	const live = {
		kind: 'screenshot',
		provenance: 'actual-capture',
		build: 'desktop-renderer',
		capture: 'full-page'
	};
	expect(
		pictures.map(({ kind, provenance, build: from, capture }) => ({
			kind,
			provenance,
			build: from,
			capture
		}))
	).toEqual([live, live, live]);
	const text = readFileSync('packages/desktop/tests/e2e/ui-entity-usage-viewports.spec.ts', 'utf8');
	const set = [...text.matchAll(/id: '(\w+)', width: (\d+), height: (\d+)/g)];
	expect(set.map(([, id]) => id)).toEqual(['tablet', 'mobile']);
	for (const [, id, width, height] of set)
		expect(scenario.viewports.find((item) => item.id === id)).toMatchObject({
			width: +width,
			height: +height
		});
	expect(scenario.viewports.find((item) => item.id === 'desktop')).toMatchObject({
		width: 1440,
		height: 900
	});
});

test('the units behind those surfaces and the scenario name each other', () => {
	const units = [
		'component.relationships-panel',
		'component.entity-view',
		'function.workspace-route',
		'style.design-0'
	];
	for (const name of units) {
		const manifest = read(`specification/units/desktop.${name}.json`) as { scenarios: string[] };
		expect([
			name,
			scenario.units.includes(`desktop.${name}`),
			manifest.scenarios.includes(scenario.id)
		]).toEqual([name, true, true]);
	}
});

test('the gate accepts the full set of fresh captures and nothing less', () => {
	expect(judged()).toMatchObject({ usage: [], gather: [] });
	expect(judged({ omit: 'usage-former-address' }).usage).toEqual([
		`${scenario.id}: missing screenshot for state usage-former-address at viewport desktop`
	]);
	const stale = judged({ unwritten: 'usage-uses' });
	expect(stale.gather).toEqual(['declared capture ui-usage-uses-desktop.png but wrote no file']);
	expect(stale.usage).toEqual([
		`${scenario.id}: missing screenshot for state usage-uses at viewport desktop`
	]);
	expect(judged({ failed: true }).statuses.flat()).toEqual(needs.map(() => 'failed'));
	expect(judged().statuses.flat()).toEqual(needs.map(() => 'passed'));
});

test('the gate rejects a capture of another revision, of another build, or of another width', () => {
	const other = judged({ revision: 'd'.repeat(40) });
	expect(other.usage).toHaveLength(needs.length);
	expect(other.usage[0]).toMatch(/was produced by revision d{40}, not c{40}$/);
	const built = judged({ buildId: 'a'.repeat(64) });
	expect(built.usage).toHaveLength(needs.length);
	expect(built.usage[0]).toMatch(
		/was served by build a{12}, not the desktop-renderer build b{12} compiled/
	);
	expect(judged({ width: 820 }).usage).toEqual([
		`${scenario.id}: capture ui-usage-overview-tablet.png is 820x1400 but viewport tablet requires 920 wide and at least 1100 tall`
	]);
	expect([other, built].map((result) => new Set(result.statuses.flat()))).toEqual([
		new Set(['failed']),
		new Set(['failed'])
	]);
});
