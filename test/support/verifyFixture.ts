import { fixtureScript } from './verifyFixtureScript';

const viewports = [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'tablet', width: 920, height: 800 },
	{ id: 'mobile', width: 390, height: 844 }
];
const state = (id: string, coverage = 'required', reason?: string) => ({
	id,
	title: id,
	coverage,
	...(reason ? { reason } : {})
});
const command = (mode: string) => ({
	id: mode,
	kind: 'e2e',
	runner: 'command',
	target: `node scripts/fixture.mjs ${mode}`
});
const scenario = (id: string, kind: string, units: string[], rest: object) => ({
	schemaVersion: 1,
	id,
	title: `${id} scenario`,
	kind,
	units: [...units, 'script.fixture'],
	viewports: [],
	...rest
});

export const fixtureScenarios = [
	scenario('titles-page', 'ui', ['page.titles'], {
		states: [
			state('empty'),
			state('filled'),
			state(
				'offline',
				'inapplicable',
				'The page is rendered on the server and never enters a client-side offline state.'
			)
		],
		viewports,
		tests: [command('page')],
		evidence: [
			{
				id: 'screens',
				kind: 'screenshot',
				states: ['empty', 'filled'],
				viewports: ['desktop', 'tablet', 'mobile'],
				required: true
			}
		]
	}),
	scenario('titles-audio', 'audio', ['service.title'], {
		states: [state('spoken')],
		tests: [command('audio')],
		evidence: [
			{
				id: 'speech',
				kind: 'audio',
				states: ['spoken'],
				viewports: [],
				provenance: 'fixture',
				required: true
			}
		]
	}),
	scenario('clock', 'headless', ['service.clock'], {
		states: [state('default')],
		tests: [command('clock')],
		evidence: [{ id: 'output', kind: 'output', states: ['default'], viewports: [], required: true }]
	}),
	scenario('titles-boundary', 'headless', ['service.title'], {
		states: [state('default')],
		tests: [command('bench')],
		evidence: [
			{ id: 'boundary', kind: 'benchmark', states: ['default'], viewports: [], required: true }
		]
	})
];

/** A real operation: it sorts generated numbers and returns a checksum of the order. */
export const rankSource = [
	'interface RankRequest {',
	'\tinput?: { size?: number; seed?: number };',
	'}',
	'',
	'export function rank(request: RankRequest): { ok: true; output: { checksum: number } } {',
	'\tlet state = request.input?.seed ?? 1;',
	'\tconst next = (): number => (state = (state * 1103515245 + 12345) % 2147483648);',
	'\tconst values = Array.from({ length: request.input?.size ?? 1000 }, next);',
	'\tvalues.sort((left, right) => left - right);',
	'\tconst weigh = (sum: number, value: number, index: number): number =>',
	'\t\t(sum + value * (index + 1)) % 1000003;',
	'\treturn { ok: true, output: { checksum: values.reduce(weigh, 0) } };',
	'}',
	''
].join('\n');

/** The same operation with redundant work: identical output, several times the latency. */
export const slowRankSource = rankSource.replace(
	'\tvalues.sort((left, right) => left - right);',
	'\tfor (let pass = 0; pass < 8; pass += 1) [...values].sort((left, right) => right - left);\n' +
		'\tvalues.sort((left, right) => left - right);'
);

export const rankWorkload = {
	schemaVersion: 1,
	id: 'rank-20k',
	request: { operation: 'rank', input: { size: 20000, seed: 7 } },
	rounds: 5,
	iterations: 30
};

const benchCommand =
	'bun "$HARNESS_CLI_PATH" budget bench function.rank --workload specification/workloads/rank-20k.json';

export const rankScenario = {
	schemaVersion: 1,
	id: 'rank-boundary',
	title: 'Rank invocation boundary',
	kind: 'headless',
	units: ['function.rank'],
	states: [state('default')],
	viewports: [],
	tests: [{ id: 'bench', kind: 'integration', runner: 'command', target: benchCommand }],
	evidence: [
		{ id: 'benchmark', kind: 'benchmark', states: ['default'], viewports: [], required: true }
	]
};

export const fixtureSources: Record<string, string> = {
	'src/utils/slugify.ts':
		'export function slugify(input: string): string {\n\treturn input.trim().toLowerCase();\n}\n',
	'src/utils/clock.ts': 'export function clock(value: string): string {\n\treturn value;\n}\n',
	'src/services/TitleService.ts': [
		"import { slugify } from '../utils/slugify';",
		'',
		'export const titleCost = 10.0;',
		'',
		'export class TitleService {',
		'\trun(title: string): string {',
		'\t\treturn slugify(title);',
		'\t}',
		'}',
		''
	].join('\n'),
	'src/services/ClockService.ts': [
		"import { clock } from '../utils/clock';",
		'',
		'export class ClockService {',
		'\trun(value: string): string {',
		'\t\treturn clock(value);',
		'\t}',
		'}',
		''
	].join('\n'),
	'src/routes/titles/+page.svelte': [
		'<script lang="ts">',
		"\timport { TitleService } from '../../services/TitleService';",
		"\tconst title = new TitleService().run('Hello');",
		'</script>',
		'',
		'<h1>{title}</h1>',
		''
	].join('\n'),
	'test/services/title.test.ts':
		"import { TitleService } from '../../src/services/TitleService';\n\nexport const subject = TitleService;\n",
	'test/services/clock.test.ts':
		"import { ClockService } from '../../src/services/ClockService';\n\nexport const subject = ClockService;\n",
	'scripts/fixture.mjs': fixtureScript,
	'harness.verify.json': JSON.stringify({
		schemaVersion: 1,
		setup: [],
		link: [],
		runners: { vitest: 'node scripts/fixture.mjs test {target}' },
		timeouts: { test: 20000 }
	})
};
