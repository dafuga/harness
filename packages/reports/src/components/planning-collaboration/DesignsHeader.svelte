<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_6monqtdung -->
<script lang="ts">
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import type {
		DesignCanvasPage,
		DesignCanvasSummary
	} from '../../utils/planning-collaboration/designCanvas.types';
	let {
		page,
		pinned = false,
		workspace,
		onreload,
		onbranch,
		canvasHref,
		oncanvas
	}: {
		page: DesignCanvasPage | null;
		pinned?: boolean;
		workspace: string;
		onreload: () => void;
		onbranch?: (branch: string) => void;
		canvasHref?: (name: string, branch: string) => string;
		oncanvas?: (name: string) => void;
	} = $props();
</script>

{#snippet caption(item: DesignCanvasSummary)}
	{item.title} <hx-small>{item.artboards}</hx-small>
{/snippet}

<hx-header class="designs-header">
	<hx-a href={workspace} data-sveltekit-reload={oncanvas ? undefined : true}>← Project</hx-a>
	<hx-h1>Designs</hx-h1>
	{#if page}
		{#if onbranch}
			<hx-label>
				Branch
				<hx-select value={page.branch} onchange={(event) => onbranch?.(event.currentTarget.value)}>
					{#each page.branches as name (name)}<hx-option value={name}>{name}</hx-option>{/each}
				</hx-select>
			</hx-label>
		{/if}
		<hx-span class="designs-commit"
			>{oncanvas
				? `${page.branch} · ${shortCommit(page.commit)} and local edits`
				: `${pinned ? 'Commit' : 'Branch tip'} ${shortCommit(page.commit)}`}</hx-span
		>
	{/if}
	{#if page || oncanvas}
		<hx-button type="button" onclick={onreload}>Reload</hx-button>
	{/if}
	{#if page}
		<hx-nav aria-label="Canvases">
			{#each page.canvases as item (item.name)}
				{#if oncanvas}
					<hx-button
						type="button"
						aria-pressed={item.name === page.canvas?.name}
						onclick={() => oncanvas?.(item.name)}>{@render caption(item)}</hx-button
					>
				{:else if canvasHref}
					<hx-a
						href={canvasHref(item.name, page.branch)}
						aria-current={item.name === page.canvas?.name ? 'page' : undefined}
						>{@render caption(item)}</hx-a
					>
				{/if}
			{/each}
		</hx-nav>
	{/if}
</hx-header>

<style>
	.designs-header {
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
		font-size: var(--hx-type-size-lg);
	}
	a {
		color: var(--hx-color-text-supporting);
	}
	label {
		display: flex;
		align-items: center;
		gap: var(--hx-space-8);
	}
	select,
	button {
		min-height: 36px;
		max-width: 60vw;
		padding: 0 var(--hx-space-10);
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-surface-raised);
		color: var(--hx-color-text);
		font: inherit;
	}
	.designs-commit {
		color: var(--hx-color-text-muted);
	}
	nav {
		display: flex;
		gap: var(--hx-space-12);
		width: 100%;
		overflow-x: auto;
		white-space: nowrap;
	}
	nav a,
	nav button {
		display: inline-flex;
		align-items: baseline;
		gap: var(--hx-space-6);
		padding: var(--hx-space-4) 0;
		border: 0;
		border-bottom: var(--hx-border-thick) solid transparent;
		border-radius: 0;
		background: transparent;
		color: var(--hx-color-text-supporting);
		text-decoration: none;
	}
	nav button {
		max-width: none;
		min-height: 44px;
		align-items: center;
	}
	nav a[aria-current='page'],
	nav button[aria-pressed='true'] {
		color: var(--hx-color-text);
		border-color: var(--hx-color-primary);
	}
</style>
