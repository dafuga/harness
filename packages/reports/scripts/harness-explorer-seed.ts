/**
 * Adds to the synthetic history what the explorer has to be able to show: a page that contains
 * a component, which contains another, which uses a function; a config; and two scenarios of
 * their own. One captures the components at three viewports. The other runs the function end to
 * end and records what it was given, what it returned and what was asserted, so a change of its
 * behaviour is a change of recorded bytes. Everything here is made up for the test.
 */
import type { VerifyRepo } from '../../../test/support/verifyRepo';

/** A branch whose tip is a verified commit, with a slash that an address has to encode. */
export const explorerBranch = 'explorer/tip';
export const explorerUnits = {
	page: 'page.titles',
	list: 'component.title-list',
	row: 'component.title-row',
	slugify: 'function.slugify',
	config: 'config.titles',
	service: 'service.title'
};
const viewports = [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'tablet', width: 920, height: 800 },
	{ id: 'mobile', width: 390, height: 844 }
];
const command = (mode: string) => ({
	id: mode,
	kind: 'e2e',
	runner: 'command',
	target: `node scripts/explorer.mjs ${mode}`
});
const scenarios = [
	{
		schemaVersion: 1,
		id: 'titles-list',
		title: 'Title list',
		kind: 'ui',
		units: [explorerUnits.list, explorerUnits.row, 'script.explorer'],
		// Each state says which component it shows, so each component has captures of its own.
		states: [
			{
				id: 'listed',
				title: 'A list of titles',
				coverage: 'required',
				units: [explorerUnits.list]
			},
			{
				id: 'row',
				title: 'One title of the list',
				coverage: 'required',
				units: [explorerUnits.row]
			}
		],
		viewports,
		tests: [command('list')],
		evidence: [
			{
				id: 'screens',
				kind: 'screenshot',
				states: ['listed', 'row'],
				viewports: viewports.map((viewport) => viewport.id),
				required: true
			}
		]
	},
	{
		schemaVersion: 1,
		id: 'slugify-run',
		title: 'Slugify titles end to end',
		kind: 'headless',
		units: [explorerUnits.slugify, 'script.explorer'],
		states: [{ id: 'default', title: 'Three synthetic titles', coverage: 'required' }],
		viewports: [],
		tests: [command('slugify')],
		evidence: [
			{ id: 'run', kind: 'output', states: ['default'], viewports: [], required: true },
			{ id: 'checks', kind: 'assertions', states: ['default'], viewports: [], required: true }
		]
	}
];

const sources: Record<string, string> = {
	'src/config/titlesConfig.ts': 'export const titlesConfig = { limit: 20 };\n',
	'src/components/TitleRow.svelte': [
		'<script lang="ts">',
		"\timport { slugify } from '../utils/slugify';",
		'\tlet { title }: { title: string } = $props();',
		'</script>',
		'',
		'<li data-slug={slugify(title)}>{title}</li>',
		''
	].join('\n'),
	'src/components/TitleList.svelte': [
		'<script lang="ts">',
		"\timport { titlesConfig } from '../config/titlesConfig';",
		"\timport TitleRow from './TitleRow.svelte';",
		'\tlet { titles }: { titles: string[] } = $props();',
		'</script>',
		'',
		'<ul>',
		'\t{#each titles.slice(0, titlesConfig.limit) as title (title)}<TitleRow {title} />{/each}',
		'</ul>',
		''
	].join('\n'),
	'src/routes/titles/+page.svelte': [
		'<script lang="ts">',
		"\timport TitleList from '../../components/TitleList.svelte';",
		"\timport { TitleService } from '../../services/TitleService';",
		"\tconst title = new TitleService().run('Hello');",
		'</script>',
		'',
		'<h1>{title}</h1>',
		'<TitleList titles={[title]} />',
		''
	].join('\n')
};

/** The check of both scenarios: a plain Node script that follows the evidence protocol. */
const script = String.raw`
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const [mode] = process.argv.slice(2);
const dir = process.env.HARNESS_EVIDENCE_DIR;
if (!dir || process.env.TAKE_SCREENSHOT !== '1') process.exit(0);
const read = (path) => readFileSync(path, 'utf8');
function capture(entry, bytes) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, entry.file), bytes);
	appendFileSync(join(dir, 'captures.ndjson'), JSON.stringify(entry) + '\n');
}
function chunk(type, data) {
	const body = Buffer.concat([Buffer.from(type), data]);
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
	return out;
}
function png(width, height, shade) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	const row = Buffer.alloc(1 + width, shade);
	row[0] = 0;
	const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0))]);
}
if (mode === 'list') {
	const sizes = { desktop: [1440, 900], tablet: [920, 800], mobile: [390, 844] };
	const shade = (read('src/components/TitleList.svelte') + read('src/components/TitleRow.svelte')).length % 251;
	const server = { buildId: 'fixture-build', revision: process.env.HARNESS_VERIFY_REVISION };
	const states = [['listed', 0], ['row', 61], ...(existsSync('src/components/TitleFrame.svelte') ? [['frame', 122]] : [])];
	for (const [state, tone] of states) {
		for (const [viewport, [width, height]] of Object.entries(sizes)) {
			const entry = { evidence: 'screens', kind: 'screenshot', state, viewport, file: state + '-' + viewport + '.png', mediaType: 'image/png', server };
			capture(entry, png(width, height, (shade + tone) % 251));
		}
	}
} else if (mode === 'slugify') {
	const source = read('src/utils/slugify.ts').replace('export ', '').replace(/: string/g, '');
	const slugify = new Function(source + '; return slugify;')();
	const input = ['  Hello World  ', 'Already-Slugged', 'why?'];
	const output = input.map((title) => slugify(title));
	const scenario = 'Slugify titles end to end';
	const run = { scenario, environment: 'node (headless)', fixture: 'Three synthetic titles', steps: ['Load the function', 'Slugify each title', 'Read what it returned'], input, output };
	const assertions = [
		{ name: 'Every title gives a result', passed: output.length === input.length },
		{ name: 'Surrounding spaces are removed', passed: output[0] === output[0].trim() },
		{ name: 'Words stay in their order', passed: output[0].toLowerCase() === 'hello world' }
	];
	capture({ evidence: 'run', kind: 'output', state: 'default', file: 'slugify-run.json', mediaType: 'application/json' }, JSON.stringify(run, null, 2));
	capture({ evidence: 'checks', kind: 'assertions', state: 'default', file: 'slugify-checks.json', mediaType: 'application/json' }, JSON.stringify({ scenario, assertions }, null, 2));
}
`;

/** Writes the explorer's part of the fixture before its first commit, and indexes it. */
export async function seedExplorer(repo: VerifyRepo): Promise<void> {
	for (const [path, contents] of Object.entries(sources)) await repo.write(path, contents);
	await repo.write('scripts/explorer.mjs', script);
	for (const scenario of scenarios) {
		await repo.write(`specification/scenarios/${scenario.id}.json`, JSON.stringify(scenario));
	}
	await repo.harness(['units', 'index', '--write']);
	for (const [id, state] of [
		[explorerUnits.list, 'listed'],
		[explorerUnits.row, 'row']
	]) {
		const path = `specification/units/${id}.json`;
		const held = await repo.json(path);
		await repo.write(
			path,
			JSON.stringify({ ...held, preview: { scenario: 'titles-list', state, viewport: 'desktop' } })
		);
	}
	await repo.harness(['units', 'index', '--write']);
}
