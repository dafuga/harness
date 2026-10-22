import { mount, unmount } from 'svelte';
import ExplorerContent from '../src/components/harness/ExplorerContent.svelte';
import HarnessShell from '../src/components/harness/HarnessShell.svelte';
import { explorerRoute, explorerRoutePath } from '../../../src/utils/explorerRoute';
import '../src/lib/styles/base.css';
import '../src/lib/styles/base-2.css';
import '../src/lib/styles/base-3.css';
import '../src/lib/styles/gallery.css';
import '../src/lib/styles/gallery-2.css';
import '../src/lib/styles/harness.css';
import type { ExplorerLocation } from '../src/models/Explorer.types';
import type { HarnessUnit, HarnessRevision } from '../src/models/Harness.types';
import { explorerEntities } from '../src/utils/explorerEntities';
import { index, revision } from './entityFixture';
import { lens, place, scope, type View } from './entityPlaces';
import {
	declaredContract,
	legacyReasons,
	previewRecord,
	withFrame,
	withMeasurements,
	withDocumentation,
	withInherited,
	withScale,
	withStates,
	withGroups,
	type PreviewVariant
} from './entityPreviewData';
import { commits, ids } from './entityUnits';
import { withServiceDocumentation } from './entityPreviewServiceDocs';
import { withServiceContracts } from './entityServiceContract';
import { withFocused } from './entityStates';
import { withHelpers } from './entityPreviewHelpers';
import { withRelationGroups } from './entityRelationFixtures';
import { sourceCatalog, sourceSnapshots } from './entitySourceFixture';

const variant = ((window as unknown as { previewVariant?: PreviewVariant }).previewVariant ??
	new URLSearchParams(location.search).get('variant')) as PreviewVariant | null;
const recorded = (commit: string, whole = true) => revision(commit, [previewRecord(commit, whole)]);
const stored: Record<string, HarnessRevision> = {
	[commits.first]: recorded(commits.first),
	[commits.middle]: {
		...recorded(commits.middle, variant !== 'partial'),
		...(variant === 'legacy' ? { explanations: legacyReasons } : {})
	},
	[commits.tip]: recorded(commits.tip)
};
if (variant === 'groups')
	for (const commit of Object.keys(stored)) stored[commit] = withGroups(stored[commit]);
if (variant === 'measurements')
	for (const commit of Object.keys(stored)) stored[commit] = withMeasurements(stored[commit]);
if (variant === 'focused')
	for (const commit of Object.keys(stored)) stored[commit] = withFocused(stored[commit]);
if (variant === 'relations')
	for (const commit of Object.keys(stored)) stored[commit] = withRelationGroups(stored[commit]);
if (variant === 'helpers')
	for (const commit of Object.keys(stored)) stored[commit] = withHelpers(stored[commit]);
if (variant === 'inherited')
	stored[commits.tip] = withInherited(stored[commits.tip], commits.middle);
if (variant === 'documented')
	for (const commit of Object.keys(stored))
		stored[commit] = withServiceDocumentation(withDocumentation(stored[commit]));
if (variant === 'states')
	for (const commit of Object.keys(stored)) stored[commit] = withStates(stored[commit]);
const hashes = (window as unknown as { artifactHashes?: Record<string, string> }).artifactHashes;
if (variant === 'source')
	for (const commit of Object.keys(stored))
		stored[commit] = sourceSnapshots(sourceCatalog(stored[commit]), hashes ?? {});
for (const detail of Object.values(stored)) {
	for (const state of detail.records
		.flatMap((item) => item.scenarios)
		.flatMap((item) => item.states)) {
		for (const capture of state.captures) {
			capture.sha256 = hashes?.[capture.media ?? ''] ?? capture.sha256;
		}
	}
}
if (variant === 'declared') {
	for (const [commit, detail] of Object.entries(stored)) {
		const { registry } = detail;
		const units = registry.units.map((unit) => {
			if (unit.id === ids.settings) return { ...unit, contract: declaredContract };
			return unit.id === ids.filter ? callableFixture(unit) : unit;
		});
		stored[commit] = withServiceContracts({ ...detail, registry: { ...registry, units } });
	}
}
if (variant === 'shells') {
	stored[commits.first] = withFrame(stored[commits.first], 'component');
	stored[commits.middle] = withFrame(stored[commits.middle], 'component');
	stored[commits.tip] = withFrame(stored[commits.tip], 'shell');
}
const parents: Record<string, string | null> = {
	[commits.first]: null,
	[commits.middle]: commits.first,
	[commits.tip]: commits.middle
};
/** The tip alone, or a selected commit beside the first parent the history gives it. */
function viewOf(route: ExplorerLocation): View {
	if (route.commit === null) {
		return { scope: scope('current', route), head: stored[commits.tip], parent: null };
	}
	const parent = parents[route.commit] ?? null;
	const at = { ...scope('commit', route), commit: route.commit, parent };
	return {
		scope: { ...at, atTip: route.commit === commits.tip },
		head: stored[route.commit],
		parent: parent ? stored[parent] : null
	};
}
const target = document.getElementById('app') as HTMLElement;
let mounted: ReturnType<typeof mount> | undefined;
function show(route: ExplorerLocation) {
	if (mounted) void unmount(mounted);
	const shown = viewOf(route);
	history.replaceState(null, '', `#${encodeURIComponent(JSON.stringify(route))}`);
	mounted = mount(ExplorerContent, {
		target,
		props: {
			index,
			head: shown.head,
			parent: shown.parent,
			scope: shown.scope,
			route,
			entities: explorerEntities(shown.head),
			lens: lens(shown),
			client: { revision: (commit: string) => Promise.resolve(stored[commit]) },
			mediaBase: '/media/',
			onroute: show,
			exportHref: ''
		}
	});
}
/** The address the page was opened at, or the pages of the branch tip without one. */
function asked(): ExplorerLocation {
	const named = decodeURIComponent(location.hash.slice(1));
	if (named) return JSON.parse(named) as ExplorerLocation;
	return (
		explorerRoute(location.pathname.replace(/^\/harness/, ''), location.search) ??
		place({ commit: null })
	);
}
window.addEventListener('hashchange', () => show(asked()));
if (variant === 'console') {
	const fetcher = window.fetch;
	window.fetch = Object.assign(
		(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
			const path = String(input);
			if (path.endsWith('/data/index.json'))
				return Promise.resolve(Response.json({ ...index, truncated: true }));
			if (path.endsWith('/data/activity.json'))
				return Promise.resolve(Response.json({ repository: { name: 'Synthetic orders' } }));
			const data = Object.entries(stored).find(([commit]) =>
				path.endsWith(`/revisions/${commit}.json`)
			)?.[1];
			if (!data) return fetcher(input, init);
			const scaled = withScale(data);
			const units = scaled.registry.units.map((unit) =>
				unit.id === ids.filter ? callableFixture(unit) : unit
			);
			return Promise.resolve(Response.json({ ...scaled, registry: { ...scaled.registry, units } }));
		},
		fetcher
	);
	history.replaceState(null, '', '/harness' + explorerRoutePath(asked()));
	mount(HarnessShell, { target, props: { base: '/harness', exportable: false } });
} else show(asked());
function callableFixture(unit: HarnessUnit): HarnessUnit {
	const returnNames: Record<string, string> = {
		toKebabCase: 'kebabCaseText',
		countWords: 'wordCount',
		reset: 'noReturnValue'
	};
	const exampleReturns: Record<string, string | number | null> = {
		toKebabCase: 'hello-world',
		countWords: 2,
		reset: null
	};
	const helpers = [
		['toKebabCase', 'string'],
		['countWords', 'number'],
		['reset', 'void']
	].map(([name, output]) => ({
		name,
		output,
		source: 'src/functions/text.ts',
		pure: true,
		consumers: [{ unit: ids.list }, { unit: ids.store }],
		examples: [
			{
				name: `${name} usage`,
				call: name === 'reset' ? 'reset() ?? null' : `${name}("hello world")`,
				input: name === 'reset' ? [] : ['hello world'],
				output: exampleReturns[name]
			}
		],
		inputs: name === 'reset' ? [] : [{ name: `${name}.textToConvert`, type: 'string' }]
	}));
	return {
		...unit,
		helpers,
		owns: { source: ['src/functions/text.ts'], symbols: helpers.map((h) => h.name) },
		contract: {
			inputs: helpers.flatMap((h) => h.inputs.map((i) => ({ ...i, examples: ['hello world'] }))),
			outputs: helpers.map((h) => ({
				name: `${h.name}.${returnNames[h.name]}`,
				type: h.output,
				...(h.output === 'void' ? {} : { examples: [h.name === 'countWords' ? 2 : 'hello-world'] })
			})),
			errors: [
				{
					name: 'countWords.invalidInput',
					type: 'TypeError',
					examples: [{ name: 'TypeError', message: 'Input text required.' }]
				}
			]
		}
	};
}
