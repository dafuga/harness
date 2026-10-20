<script lang="ts">
	import { entityLabels } from '../utils/entityLens';
	import type { SearchEntry } from '../utils/entitySearch';
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

<div class="entity-search-results">
	<p class="entity-search-note">{scope}</p>
	{#if query}
		<ul {id} role="listbox" aria-label="Entities found">
			{#each found as entry, index (entry.id)}
				<li id="{id}-{index}" role="option" aria-selected={index === active}>
					<a
						href={href(entry)}
						tabindex="-1"
						onmousedown={(event) => event.preventDefault()}
						onclick={(event) => follow(event, entry)}
					>
						<span class="entity-search-badge">{entityLabels[entry.category].one}</span>
						<span class="entity-search-name">{entry.name}</span>
						{#if entry.purpose}<span class="entity-search-purpose">{entry.purpose}</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
		{#if loading}
			<p class="entity-search-note" role="status">Loading entities…</p>
		{:else if !found.length}
			<p class="entity-search-note" role="status">No entity matches “{query}”</p>
		{/if}
	{:else}
		<!-- Nothing typed yet: what can be found, and the keys that find it. -->
		<p class="entity-search-note">Type a name or a purpose to find an entity of this revision.</p>
		<p class="entity-search-note entity-search-keys">
			<kbd>↑</kbd> <kbd>↓</kbd> move · <kbd>Enter</kbd> opens · <kbd>Esc</kbd> closes
		</p>
	{/if}
</div>

<style>
	/* The body of the dialog the search opens: its field, then these results, the part that scrolls. */
	:global(.entity-search .viewer-dialog[open] .viewer-content) {
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: 6px;
		min-height: 0;
		padding: 12px;
	}
	.entity-search-results {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		line-height: 1.4;
		text-align: left;
	}
	.entity-search-note {
		margin: 6px 8px;
		color: var(--muted, #8fa1b8);
		font-size: 12px;
		line-height: 1.4;
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
		gap: 2px 10px;
		padding: 8px 10px;
		border-radius: 8px;
		color: inherit;
		text-decoration: none;
	}
	[aria-selected='true'] a,
	.entity-search-results a:hover {
		background: rgb(255 255 255 / 0.07);
		box-shadow: inset 2px 0 0 var(--gold, #f3c33b);
	}
	.entity-search-badge {
		grid-row: span 2;
		align-self: start;
		justify-self: start;
		padding: 2px 8px;
		border: 1px solid var(--line, #24485c);
		border-radius: 999px;
		color: var(--gold, #f3c33b);
		font-size: 11px;
		font-weight: 600;
	}
	.entity-search-name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.entity-search-purpose {
		color: var(--muted, #8fa1b8);
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	kbd {
		display: inline-block;
		min-width: 1.6em;
		padding: 1px 6px;
		border: 1px solid var(--line, #24485c);
		border-radius: 5px;
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
