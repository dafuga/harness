<script lang="ts">
	import { tick } from 'svelte';
	import { entitySearch, type SearchEntry } from '../utils/entitySearch';
	import EntitySearchResults from './EntitySearchResults.svelte';
	import Modal from './Modal.svelte';
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
	<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
		<circle cx="11" cy="11" r="6.5" />
		<path d="m16 16 4.5 4.5" />
	</svg>
{/snippet}

<svelte:window onkeydown={shortcut} />
<div class="entity-search">
	<button
		bind:this={trigger}
		type="button"
		class="entity-search-trigger"
		aria-label="Search entities"
		aria-haspopup="dialog"
		aria-keyshortcuts="Meta+K Control+K"
		title="Search entities (⌘K)"
		onclick={show}>{@render glass(18)}</button
	>
	<Modal open={searching} title="Search project" variant="text" onClose={hide}>
		<div class="entity-search-field">
			{@render glass(16)}
			<input
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
		</div>
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
</div>

<style>
	svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
	/* The icon and the close button: under classes, so no host rule for buttons restyles them. */
	.entity-search-trigger,
	.entity-search :global(.viewer-dialog .viewer-header button) {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid var(--line, #24485c);
		border-radius: 8px;
		background: none;
		color: inherit;
		font-size: 24px;
		cursor: pointer;
	}
	.entity-search-trigger:hover,
	.entity-search :global(.viewer-dialog .viewer-header button:hover) {
		border-color: var(--gold, #f3c33b);
		color: var(--gold, #f3c33b);
	}
	.entity-search-trigger:focus-visible,
	.entity-search :global(.viewer-dialog .viewer-header button:focus-visible),
	.entity-search-field:focus-within {
		outline: 2px solid var(--gold, #f3c33b);
		outline-offset: 1px;
	}
	/* The shared dialog at this search's own size, near the top, in navy and gold on either host. */
	.entity-search :global(.viewer-dialog[open]) {
		display: flex;
		flex-direction: column;
		width: min(640px, calc(100vw - 24px));
		max-width: none;
		height: auto;
		max-height: calc(100dvh - min(12vh, 96px) - 12px);
		margin: min(12vh, 96px) auto auto;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--line, #24485c);
		border-radius: 14px;
		background: var(--panel, #082131);
		color: #edf4fa;
		font-size: 15px;
		box-shadow: 0 24px 80px rgb(0 0 0 / 0.55);
	}
	.entity-search :global(.viewer-dialog[open])::backdrop {
		background: rgb(2 12 20 / 0.78);
	}
	.entity-search :global(.viewer-dialog .viewer-header) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 8px 8px 18px;
		border-bottom: 1px solid var(--line, #24485c);
		background: none;
	}
	.entity-search :global(.viewer-dialog h2) {
		margin: 0;
		font-size: inherit;
	}
	.entity-search-field {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 14px;
		border: 1px solid var(--line, #24485c);
		border-radius: 10px;
		background: rgb(255 255 255 / 0.04);
		color: var(--muted, #8fa1b8);
	}
	/* Under the field's border, which shows the focus; sixteen pixels, so a phone does not zoom in. */
	input {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		padding: 0;
		border: 0;
		outline: none;
		background: none;
		color: #edf4fa;
		font: inherit;
		font-size: 16px;
	}
	input::placeholder {
		color: var(--muted, #8fa1b8);
	}
</style>
