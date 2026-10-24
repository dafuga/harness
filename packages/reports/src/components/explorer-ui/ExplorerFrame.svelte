<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Opened } from './ExplorerFrame.types';

	import { tick, type Snippet } from 'svelte';
	import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
	import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';
	import { entityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import '../../lib/styles/entity.css';
	import '../../lib/styles/entity-summary.css';
	import '../../lib/styles/entity-index.css';
	import '../../lib/styles/entity-evidence.css';
	import '../../lib/styles/entity-history.css';
	import EntityMissing from './EntityMissing.svelte';
	import { archivedSource } from '../../lib/explorer-ui/stores/sourceReader.svelte';
	import SourceDialog from './SourceDialog.svelte';
	let {
		host,
		children,
		registryRequired = true
	}: {
		/** What the host of the explorer gives the screen. */
		host: ExplorerScreenProps;
		/** Platform declarations are readable independently of a source-unit registry. */
		registryRequired?: boolean;
		/** The screen itself, drawn only where the revision has a registry to read it from. */
		children: Snippet<[EntityNav]>;
	} = $props();
	// One reader for the screen, however many entities it lists; opening it changes no address.
	let source = $state.raw<Opened | null>(null);
	let route = $derived(
		`${host.route.branch}|${host.route.category}|${host.route.entity ?? ''}|${host.route.helper ?? ''}`
	);
	function openSource(
		entity: ExplorerEntity,
		title = entity.name,
		trigger?: HTMLElement,
		path?: string
	) {
		source = { entity, title, trigger, path, at: host.scope.commit, route };
	}
	async function closeSource() {
		const trigger = source?.trigger;
		source = null;
		await tick();
		if (trigger?.isConnected) trigger.focus();
	}
	// The code of one revision is never shown under another: a new revision closes it.
	let shown = $derived(source?.at === host.scope.commit && source.route === route ? source : null);
	let reader = $derived(shown && archivedSource(shown.entity.unit, host.mediaBase, shown.path));
	$effect(() => {
		if (source && !shown) source = null;
	});
	let nav = $derived<EntityNav>({
		route: host.route,
		href: host.lens.href,
		go: host.onroute,
		source: openSource
	});
	let registry = $derived(host.head.registry);
	let gap = $derived(
		registry.gap ?? `No unit registry is stored at ${shortCommit(host.scope.commit)}`
	);
</script>

<!-- The marker of the frame draws no box: the content is laid out as the column holds it. -->
<hx-div class="ex-frame" data-harness-component="harness-explorer-frame">
	<hx-div class="ex-content" data-mode={host.scope.mode}>
		{#if registryRequired && !registry.available}
			<EntityMissing
				title="No registry at this revision"
				message={`${gap}.`}
				{nav}
				to={entityLens(host.route, { category: host.route.category })}
				action="Stay on this revision"
			/>
		{:else}
			{@render children(nav)}
		{/if}
		{#if shown && reader}
			<!-- A removed unit's code is its parent's, so it is labelled with that commit. -->
			<SourceDialog
				open
				title={shown.title}
				files={reader.files}
				read={reader.read}
				empty={reader.empty}
				commit={shown.entity.lastAt ?? shown.at}
				onClose={closeSource}
			/>
		{/if}
	</hx-div>
</hx-div>

<style>
	.ex-frame {
		display: contents;
	}
</style>
