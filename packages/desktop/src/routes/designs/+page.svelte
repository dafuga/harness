<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_dsgnr5utex -->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getContext, onMount } from 'svelte';
	import DesignCanvas from '$shared/planning-collaboration/design-canvas/DesignCanvas.svelte';
	import { shortCommit } from '$reports/helpers/strings/shortCommit';
	import type { DesignCanvasPage } from '$reports/utils/planning-collaboration/designCanvas.types';
	import { nativeAccountContext } from '../../models/development-tooling/Environment.types';
	import type { NativeAccountContext } from '../../models/development-tooling/Environment.types';

	const { environment } = getContext<NativeAccountContext>(nativeAccountContext);
	const projectId = $derived(page.url.searchParams.get('projectId') ?? undefined);
	/** Only an address inside the workspace is gone back to. */
	const back = $derived.by(() => {
		const from = page.url.searchParams.get('from') ?? '';
		return /^\/(projects\/[^/?#]+\/)?harness\//.test(from) ? from : '/';
	});
	let shown = $state<DesignCanvasPage | null>(null);
	let failure = $state('');
	let chosen = $state<string | null>(null);
	let asked = 0;

	async function read(canvas: string | null) {
		const turn = ++asked;
		const load = environment?.bridge?.designCanvases;
		if (!load) {
			failure = 'Designs are read from a project on this Mac.';
			return;
		}
		try {
			const answer = await load({ projectId, canvas });
			if (turn !== asked) return;
			shown = answer;
			chosen = answer.canvas?.name ?? null;
			failure = '';
		} catch (cause) {
			if (turn !== asked) return;
			shown = null;
			failure = cause instanceof Error ? cause.message : 'The designs could not be read.';
		}
	}

	/** An agent edits the files while this is open, so coming back reads them again. */
	onMount(() => {
		void read(null);
		const again = () => void read(chosen);
		window.addEventListener('focus', again);
		return () => {
			asked++;
			window.removeEventListener('focus', again);
		};
	});
</script>

<svelte:head><title>Designs · Harness</title></svelte:head>

<hx-div class="designs-page">
	<hx-header>
		<hx-a href={resolve(back as '/')}>← Project</hx-a>
		<hx-h1>Designs</hx-h1>
		{#if shown}
			<hx-span>{shown.branch} · {shortCommit(shown.commit)} and local edits</hx-span>
		{/if}
		<hx-button type="button" onclick={() => void read(chosen)}>Reload</hx-button>
		{#if shown}
			<hx-nav aria-label="Canvases">
				{#each shown.canvases as item (item.name)}
					<hx-button
						type="button"
						aria-pressed={item.name === chosen}
						onclick={() => void read(item.name)}>{item.title}</hx-button
					>
				{/each}
			</hx-nav>
		{/if}
	</hx-header>
	{#if failure}<hx-p role="alert">{failure}</hx-p>
	{:else if !shown}<hx-p role="status">Loading designs…</hx-p>
	{:else if shown.canvas}<DesignCanvas canvas={shown.canvas} />
	{:else}<hx-p>No canvas in this checkout. An agent adds one with harness design new.</hx-p>{/if}
</hx-div>

<style>
	.designs-page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: var(--hx-color-background);
		color: var(--hx-color-text);
	}
	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-12);
		padding: var(--hx-space-12) var(--hx-space-18);
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border);
		background: var(--hx-color-surface);
	}
	h1 {
		margin: 0;
		font-size: var(--hx-type-size-md, 1.1rem);
	}
	a,
	span {
		color: var(--hx-color-text-supporting);
	}
	nav {
		display: flex;
		gap: var(--hx-space-12);
		width: 100%;
		overflow-x: auto;
	}
	button {
		min-height: 36px;
		padding: 0 10px;
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: 8px;
		background: var(--hx-color-surface-raised);
		color: var(--hx-color-text);
		font: inherit;
		white-space: nowrap;
	}
	button[aria-pressed='true'] {
		border-color: var(--hx-color-primary);
	}
	p {
		padding: var(--hx-space-32) var(--hx-space-24);
		text-align: center;
	}
</style>
