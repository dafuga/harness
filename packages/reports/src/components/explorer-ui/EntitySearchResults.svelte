<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import { entityLabels } from '../../utils/explorer-ui/entityLens';
	import type { SearchEntry } from '../../utils/explorer-ui/entitySearch';
	let {
		id,
		found,
		active,
		loading,
		query,
		scope,
		href,
		choose
	}: {
		/** The id of the field's list, and the prefix of each option's id. */
		id: string;
		found: SearchEntry[];
		active: number;
		/** True while the host has nothing of the shown revision to search. */
		loading: boolean;
		query: string;
		/** Which revision is searched, in words. */
		scope: string;
		href: (entry: SearchEntry) => string;
		choose: (entry: SearchEntry) => void;
	} = $props();
	/** A plain click stays in the host; any other is the link it is. */
	function follow(event: MouseEvent, entry: SearchEntry) {
		const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
		if (event.button !== 0 || modified) return;
		event.preventDefault();
		choose(entry);
	}
	// The list scrolls inside the dialog, so the active result is kept in its view.
	$effect(() => {
		const option = query ? document.getElementById(`${id}-${active}`) : null;
		option?.scrollIntoView?.({ block: 'nearest' });
	});
</script>

<hx-div class="entity-search-results" data-harness-component="entity-search-results">
	<hx-p class="entity-search-note">{scope}</hx-p>
	{#if query}
		<hx-ul {id} role="listbox" aria-label="Entities found">
			{#each found as entry, index (entry.id)}
				<hx-li id="{id}-{index}" role="option" aria-selected={index === active}>
					<hx-a
						href={href(entry)}
						tabindex="-1"
						onmousedown={(event) => event.preventDefault()}
						onclick={(event) => follow(event, entry)}
					>
						<hx-span class="entity-search-badge">{entityLabels[entry.category].one}</hx-span>
						<hx-span class="entity-search-name">{entry.name}</hx-span>
						{#if entry.purpose}<hx-span class="entity-search-purpose">{entry.purpose}</hx-span>{/if}
					</hx-a>
				</hx-li>
			{/each}
		</hx-ul>
		{#if loading}
			<hx-p class="entity-search-note" role="status">Loading entities…</hx-p>
		{:else if !found.length}
			<hx-p class="entity-search-note" role="status">No entity matches “{query}”</hx-p>
		{/if}
	{:else}
		<!-- Nothing typed yet: what can be found, and the keys that find it. -->
		<hx-p class="entity-search-note"
			>Type a name or a purpose to find an entity of this revision.</hx-p
		>
		<hx-p class="entity-search-note entity-search-keys">
			<hx-kbd>↑</hx-kbd> <hx-kbd>↓</hx-kbd> move · <hx-kbd>Enter</hx-kbd> opens ·
			<hx-kbd>Esc</hx-kbd> closes
		</hx-p>
	{/if}
</hx-div>

<style>
	/* The body of the dialog the search opens: its field, then these results, the part that scrolls. */
	:global(.entity-search .viewer-dialog[open] .viewer-content) {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: var(--hx-space-6);
		min-height: 0;
		padding: var(--hx-space-12);
	}
	.entity-search-results {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		line-height: var(--hx-style-leading-snug);
		text-align: left;
	}
	.entity-search-note {
		margin: var(--hx-space-6) var(--hx-space-8);
		color: var(--hx-color-text-muted, var(--hx-color-text-muted));
		font-size: var(--hx-type-size-xs);
		line-height: var(--hx-style-leading-snug);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Under the list's class, so a host's own rule for links neither colours nor sizes a result. */
	.entity-search-results a {
		display: grid;
		/* One badge column for every result, so the names start in one line. */
		grid-template-columns: 5.5rem minmax(0, 1fr);
		gap: var(--hx-space-2) var(--hx-space-10);
		padding: var(--hx-space-8) var(--hx-space-10);
		border-radius: var(--hx-radius-small);
		color: inherit;
		text-decoration: none;
	}
	[aria-selected='true'] a,
	.entity-search-results a:hover {
		background: var(--hx-color-selected);
		box-shadow: inset var(--hx-space-2) 0 0 var(--hx-color-primary);
	}
	.entity-search-badge {
		grid-row: span 2;
		align-self: start;
		justify-self: start;
		padding: var(--hx-space-2) var(--hx-space-8);
		border: var(--hx-border-thin) solid var(--hx-color-border, var(--hx-color-border));
		border-radius: var(--hx-radius-pill);
		color: var(--hx-color-primary);
		font-size: var(--hx-type-size-2xs);
		font-weight: var(--hx-style-weight-semibold);
	}
	.entity-search-name {
		font-weight: var(--hx-style-weight-semibold);
		overflow-wrap: anywhere;
	}
	.entity-search-purpose {
		color: var(--hx-color-text-muted, var(--hx-color-text-muted));
		font-size: var(--hx-type-size-xs);
		overflow-wrap: anywhere;
	}
	kbd {
		display: inline-block;
		min-width: 1.6em;
		padding: var(--hx-space-1) var(--hx-space-6);
		border: var(--hx-border-thin) solid var(--hx-color-border, var(--hx-color-border));
		border-radius: var(--hx-radius-xsmall);
		font: inherit;
		text-align: center;
	}
	/* A touch screen has no keys to name. */
	@media (pointer: coarse) {
		.entity-search-keys {
			display: none;
		}
	}
</style>
