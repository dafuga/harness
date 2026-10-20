import { mount, unmount } from 'svelte';
import ExplorerContent from '../src/components/harness/ExplorerContent.svelte';
import HarnessShell from '../src/components/harness/HarnessShell.svelte';
import { explorerRoutePath } from '../../../src/utils/explorerRoute';
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
	withDocumentation,
	withInherited,
	withScale,
	withStates,
	type PreviewVariant
} from './entityPreviewData';
import { commits, ids } from './entityUnits';

/** The synthetic history in a browser, for the checks that need one; no server and no real data. */
const variant = new URLSearchParams(location.search).get('variant') as PreviewVariant | null;
const recorded = (commit: string, whole = true) => revision(commit, [previewRecord(commit, whole)]);
const stored: Record<string, HarnessRevision> = {
	[commits.first]: recorded(commits.first),
	// A variant shows the selected commit with a state uncaptured, or with reasons at old length.
	[commits.middle]: {
		...recorded(commits.middle, variant !== 'partial'),
		...(variant === 'legacy' ? { explanations: legacyReasons } : {})
	},
	[commits.tip]: recorded(commits.tip)
};
if (variant === 'helpers')
	for (const commit of Object.keys(stored)) stored[commit] = withHelpers(stored[commit]);
if (variant === 'inherited')
	stored[commits.tip] = withInherited(stored[commits.tip], commits.middle);
if (variant === 'documented')
	for (const commit of Object.keys(stored)) stored[commit] = withDocumentation(stored[commit]);
if (variant === 'states')
	for (const commit of Object.keys(stored)) stored[commit] = withStates(stored[commit]);
const hashes = (window as unknown as { artifactHashes?: Record<string, string> }).artifactHashes;
// A recorded hash is the hash of the bytes the page is served, as a real history has it.
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
	// Every viewed revision, including the branch tip, declares the same example contract.
	for (const [commit, detail] of Object.entries(stored)) {
		const { registry } = detail;
		const units = registry.units.map((unit) => {
			if (unit.id === ids.page) return { ...unit, contract: declaredContract };
			return unit.id === ids.filter ? callableFixture(unit) : unit;
		});
		stored[commit] = { ...detail, registry: { ...registry, units } };
	}
}

if (variant === 'shells') {
	// The frame was recorded as a component; the tip's manifest declares it a shell.
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
	return named ? (JSON.parse(named) as ExplorerLocation) : place({ commit: null });
}
// Going to a place rewrites the address without this event; only an address typed or opened fires it.
window.addEventListener('hashchange', () => show(asked()));
if (variant === 'console') {
	// The real console and client, over this same fixture. Each response is a fresh JSON tree,
	// as it is over the network; no in-memory Svelte data is substituted for the host.
	const fetcher = window.fetch;
	window.fetch = Object.assign(
		(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
			const path = String(input);
			if (path.endsWith('/data/index.json')) return Promise.resolve(Response.json(index));
			if (path.endsWith('/data/activity.json')) {
				return Promise.resolve(Response.json({ repository: { name: 'Synthetic orders' } }));
			}
			const data = Object.entries(stored).find(([commit]) =>
				path.endsWith(`/revisions/${commit}.json`)
			)?.[1];
			return data ? Promise.resolve(Response.json(withScale(data))) : fetcher(input, init);
		},
		fetcher
	);
	history.replaceState(null, '', '/harness' + explorerRoutePath(asked()));
	mount(HarnessShell, { target, props: { base: '/harness', exportable: false } });
} else show(asked());

/** Source-derived helper metadata distinguishes callable utilities from implementation units. */
function withHelpers(detail: HarnessRevision): HarnessRevision {
	const template = detail.registry.units.find((unit) => unit.id === ids.filter)!;
	const hidden = ['types', 'schema', 'private', 'class-method', 'legacy', 'unused', 'single'].map(
		(kind) => {
			let helpers: typeof template.helpers = kind === 'legacy' ? undefined : [];
			if (kind === 'unused' || kind === 'single') {
				helpers = template.helpers?.map((helper) => ({
					...helper,
					name: kind,
					consumers: kind === 'single' ? [{ unit: ids.list }] : []
				}));
			}
			return {
				...template,
				id: `function.${kind}`,
				title: kind,
				helpers
			};
		}
	);
	return {
		...detail,
		registry: { ...detail.registry, units: [...detail.registry.units, ...hidden] }
	};
}

function callableFixture(unit: HarnessUnit): HarnessUnit {
	const returnNames: Record<string, string> = {
		toKebabCase: 'kebabCaseText',
		countWords: 'wordCount',
		reset: 'noReturnValue'
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
