<script lang="ts">
	import { entitySearch, type SearchEntry } from '../utils/entitySearch';
	import EntitySearchResults from './EntitySearchResults.svelte';
	let {
		entries,
		scope,
		href,
		open
	}: {
		/** Every entity of the revision in view; null while the host is still reading it. */
		entries: SearchEntry[] | null;
		/** Which revision is searched, in words; `pinned` is the short commit when one is selected. */
		scope: { label: string; pinned: string | null };
		/** The whole address of a result, so it is a link like any other. */
		href: (entry: SearchEntry) => string;
		/** Follows a result inside the host. */
		open: (entry: SearchEntry) => void;
	} = $props();
	const id = $props.id();
	let query = $state('');
	let expanded = $state(false);
	let active = $state(0);
	let root = $state<HTMLElement>();
	/** How far the results move left so that they end inside the screen. */
	let shift = $state(0);
	const found = $derived(entries ? entitySearch(entries, query, 12) : []);
	const shown = $derived(expanded && query.trim() !== '');
	// A selected commit is always named; while its entities are read, the list says so.
	const placeholder = $derived(
		scope.pinned
			? `Search at ${scope.pinned}`
			: entries === null
				? 'Loading entities…'
				: 'Search entities'
	);
	function choose(entry: SearchEntry) {
		[expanded, query] = [false, ''];
		open(entry);
	}
	const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
	/** Up and Down move the active result, Enter opens it, Escape closes and then clears. */
	function keys(event: KeyboardEvent) {
		const step = steps[event.key];
		if (step) {
			event.preventDefault();
			expanded = true;
			if (found.length) active = (active + step + found.length) % found.length;
		} else if (event.key === 'Enter' && shown && found[active]) {
			event.preventDefault();
			choose(found[active]);
		} else if (event.key === 'Escape') {
			// The search answers its own Escape: nothing around it, such as an open panel, closes.
			event.stopPropagation();
			if (shown) expanded = false;
			else query = '';
		}
	}
	function place() {
		if (!root) return;
		const width = Math.min(440, innerWidth - 24);
		shift = Math.max(0, root.getBoundingClientRect().left + width + 12 - innerWidth);
	}
	$effect(() => {
		if (shown) place();
	});
	function left(event: FocusEvent) {
		const into = event.relatedTarget as Node | null;
		if (!into || !(event.currentTarget as Node).contains(into)) expanded = false;
	}
</script>

<svelte:window onresize={() => shown && place()} />
<div class="entity-search" bind:this={root} onfocusout={left}>
	<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
		<circle cx="11" cy="11" r="6.5" />
		<path d="m16 16 4.5 4.5" />
	</svg>
	<input
		type="text"
		role="combobox"
		aria-label="Search entities"
		aria-autocomplete="list"
		aria-expanded={shown}
		aria-controls="{id}-list"
		aria-activedescendant={shown && found[active] ? `${id}-list-${active}` : undefined}
		autocomplete="off"
		spellcheck="false"
		{placeholder}
		bind:value={query}
		oninput={() => ([expanded, active] = [true, 0])}
		onfocus={() => (expanded = true)}
		onkeydown={keys}
	/>
	{#if shown}
		<EntitySearchResults
			id="{id}-list"
			{found}
			{active}
			loading={entries === null}
			query={query.trim()}
			scope={scope.label}
			{shift}
			{href}
			{choose}
		/>
	{/if}
</div>

<style>
	/* The host decides where the field sits and how wide it is; the field fills that place. */
	.entity-search {
		position: relative;
		width: 100%;
		/* Its field may be narrower than its placeholder; the host's place decides. */
		min-width: 0;
	}
	svg {
		position: absolute;
		top: 50%;
		left: 11px;
		transform: translateY(-50%);
		fill: none;
		stroke: var(--muted, #8fa1b8);
		stroke-width: 2;
		stroke-linecap: round;
		pointer-events: none;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-height: 40px;
		padding: 8px 12px 8px 34px;
		border: 1px solid var(--line, #24485c);
		border-radius: 10px;
		background: rgb(255 255 255 / 0.04);
		color: inherit;
		font: inherit;
		font-size: 14px;
		text-overflow: ellipsis;
		/* A host's own rule for inputs, such as a minimum width, does not size this field. */
		min-width: 0;
	}
	input::placeholder {
		color: var(--muted, #8fa1b8);
	}
	input:focus-visible {
		border-color: var(--gold, #f3c33b);
		outline: 2px solid var(--gold, #f3c33b);
		outline-offset: 1px;
	}
</style>
