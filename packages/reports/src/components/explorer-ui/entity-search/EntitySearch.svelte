<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import './entitySearch.css';
	import { tick } from 'svelte';
	import { entitySearch } from './entitySearch';
	import { type SearchEntry } from '../../../utils/explorer-ui/entitySearch';
	import EntitySearchResults from '../EntitySearchResults.svelte';
	import Modal from '../../shared-primitives/Modal.svelte';
	let {
		entries,
		scope,
		href,
		open
	}: {
		entries: SearchEntry[] | null;
		scope: { label: string; pinned: string | null };
		href: (entry: SearchEntry) => string;
		open: (entry: SearchEntry) => void;
	} = $props();
	const id = $props.id();
	let query = $state('');
	let active = $state(0);
	let searching = $state(false);
	let trigger = $state<HTMLButtonElement>();
	let field = $state<HTMLInputElement>();
	const found = $derived(entries ? entitySearch(entries, query, 12) : []);
	const shown = $derived(query.trim() !== '');
	const placeholder = $derived(
		scope.pinned
			? `Search at ${scope.pinned}`
			: entries === null
				? 'Loading entities…'
				: 'Search entities'
	);
	async function show() {
		searching = true;
		await tick();
		field?.focus();
	}
	async function hide() {
		[searching, query, active] = [false, '', 0];
		await tick();
		trigger?.focus();
	}
	function choose(entry: SearchEntry) {
		void hide();
		open(entry);
	}
	const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
	function keys(event: KeyboardEvent) {
		const step = steps[event.key];
		if (step) {
			event.preventDefault();
			if (found.length) active = (active + step + found.length) % found.length;
		} else if (event.key === 'Enter' && shown && found[active]) {
			event.preventDefault();
			choose(found[active]);
		} else if (event.key === 'Escape') {
			// The search answers its own Escape: nothing around it, such as an open panel, closes.
			event.preventDefault();
			event.stopPropagation();
			void hide();
		}
	}
	function shortcut(event: KeyboardEvent) {
		const chord = (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
		if (!chord || !/^k$/i.test(event.key)) return;
		event.preventDefault();
		if (!event.repeat) void show();
	}
</script>

{#snippet glass(size: number)}
	<hx-svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
		<hx-svg-circle cx="11" cy="11" r="6.5" />
		<hx-svg-path d="m16 16 4.5 4.5" />
	</hx-svg>
{/snippet}

<svelte:window onkeydown={shortcut} />
<hx-div class="entity-search" data-harness-component="entity-search">
	<hx-button
		bind:this={trigger}
		type="button"
		class="entity-search-trigger"
		aria-label="Search entities"
		aria-haspopup="dialog"
		aria-keyshortcuts="Meta+K Control+K"
		title="Search entities (⌘K)"
		onclick={show}>{@render glass(18)}<hx-span>Search entities</hx-span></hx-button
	>
	<Modal open={searching} title="Search project" variant="text" onClose={hide}>
		<hx-div class="entity-search-field">
			{@render glass(16)}
			<hx-input
				bind:this={field}
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
				oninput={() => (active = 0)}
				onkeydown={keys}
			/>
		</hx-div>
		<EntitySearchResults
			id="{id}-list"
			{found}
			{active}
			loading={entries === null}
			query={query.trim()}
			scope={scope.label}
			{href}
			{choose}
		/>
	</Modal>
</hx-div>
