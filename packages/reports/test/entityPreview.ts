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
import type { HarnessRevision } from '../src/models/Harness.types';
import { explorerEntities } from '../src/utils/explorerEntities';
import { index, revision } from './entityFixture';
import { lens, place, scope, type View } from './entityPlaces';
import {
	declaredContract,
	legacyReasons,
	previewRecord,
	withFrame,
	withScale,
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
	// The page of the selected commit carries a contract that says what each of its items is.
	const { registry } = stored[commits.middle];
	const units = registry.units.map((unit) =>
		unit.id === ids.page ? { ...unit, contract: declaredContract } : unit
	);
	stored[commits.middle] = { ...stored[commits.middle], registry: { ...registry, units } };
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
	window.fetch = (input, init) => {
		const path = String(input);
		const data = path.endsWith('/data/index.json')
			? index
			: path.endsWith('/data/activity.json')
				? { repository: { name: 'Synthetic orders' } }
				: Object.entries(stored).find(([commit]) =>
						path.endsWith(`/revisions/${commit}.json`)
					)?.[1];
		return data
			? Promise.resolve(Response.json('registry' in data ? withScale(data) : data))
			: fetcher(input, init);
	};
	history.replaceState(null, '', '/harness' + explorerRoutePath(asked()));
	mount(HarnessShell, { target, props: { base: '/harness', exportable: false } });
} else show(asked());
