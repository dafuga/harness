<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_6monqtdung -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { shortCommit } from '$reports/helpers/strings/shortCommit';
	import type { DesignCanvasPage } from '$reports/utils/planning-collaboration/designCanvas.types';
	let {
		projectId,
		page,
		pinned,
		workspace,
		onreload
	}: {
		projectId: string;
		page: DesignCanvasPage | null;
		pinned: boolean;
		workspace: string;
		onreload: () => void;
	} = $props();
	const address = (canvas: string | undefined, branch: string) =>
		resolve('/projects/[projectId]/designs/[[canvas]]', { projectId, canvas }) +
		`?branch=${encodeURIComponent(branch)}`;
	function choose(event: Event) {
		const branch = (event.currentTarget as HTMLSelectElement).value;
		const path = resolve('/projects/[projectId]/designs/[[canvas]]', { projectId });
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the resolved path with its branch
		void goto(`${path}?branch=${encodeURIComponent(branch)}`);
	}
</script>

<hx-header class="designs-header">
	<!-- Leaving for the workspace is a document navigation: its history entries are its own. -->
	<hx-a href={workspace} data-sveltekit-reload>← Project</hx-a>
	<hx-h1>Designs</hx-h1>
	{#if page}
		<hx-label>
			Branch
			<hx-select value={page.branch} onchange={choose}>
				{#each page.branches as name (name)}<hx-option value={name}>{name}</hx-option>{/each}
			</hx-select>
		</hx-label>
		<hx-span class="designs-commit">
			{pinned ? 'Commit' : 'Branch tip'}
			{shortCommit(page.commit)}
		</hx-span>
		<hx-button type="button" onclick={onreload}>Reload</hx-button>
		<hx-nav aria-label="Canvases">
			{#each page.canvases as item (item.name)}
				<hx-a
					href={address(item.name, page.branch)}
					aria-current={item.name === page.canvas?.name ? 'page' : undefined}
					>{item.title} <hx-small>{item.artboards}</hx-small></hx-a
				>
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
		font-size: var(--hx-type-size-md, 1.1rem);
	}
	a {
		color: var(--hx-color-text-supporting);
	}
	label {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	select,
	button {
		min-height: 36px;
		max-width: 60vw;
		padding: 0 10px;
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: 8px;
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
	nav a {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		padding: 4px 0;
		border-bottom: 2px solid transparent;
		text-decoration: none;
	}
	nav a[aria-current='page'] {
		color: var(--hx-color-text);
		border-color: var(--hx-color-primary);
	}
</style>
