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
		shift,
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
		/** How far the list moves left of the field so that it ends inside the screen. */
		shift: number;
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
</script>

<div class="entity-search-popup" style:left="{-shift}px">
	<p class="entity-search-note">{scope}</p>
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
</div>

<style>
	.entity-search-popup {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 60;
		box-sizing: border-box;
		width: min(440px, calc(100vw - 24px));
		max-height: min(60vh, 460px);
		overflow-y: auto;
		padding: 6px;
		border: 1px solid var(--line, #24485c);
		border-radius: 12px;
		background: var(--panel, #082131);
		box-shadow: 0 14px 40px rgb(0 0 0 / 0.5);
		text-align: left;
	}
	.entity-search-note {
		margin: 6px 8px;
		color: var(--muted, #8fa1b8);
		font-size: 12px;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
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
	a:hover {
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
</style>
