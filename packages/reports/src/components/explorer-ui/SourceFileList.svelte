<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		files,
		label = 'Source files',
		empty = 'No source files recorded at this revision.',
		relativeTo = '',
		href,
		children
	}: {
		files: string[];
		label?: string;
		empty?: string;
		relativeTo?: string;
		href: (path: string) => string | undefined;
		children: Snippet<[string]>;
	} = $props();
</script>

{#if files.length}
	<hx-ul class="source-files" aria-label={label}>
		{#each files as path, position (position)}
			{@const url = href(path)}
			{@const shown = path.startsWith(relativeTo) ? path.slice(relativeTo.length) : path}
			{@const split = shown.lastIndexOf('/')}
			{@const folder = split < 0 ? '' : shown.slice(0, split)}
			{@const name = shown.slice(split + 1)}
			<hx-li>
				{#if url}<hx-a href={url} target="_blank" rel="noreferrer" title={path} aria-label={path}>
						{#if folder}<hx-span class="source-folder">{folder}</hx-span>{/if}<hx-span
							class="source-name">{folder ? '/' : ''}{name}</hx-span
						>
					</hx-a>
				{:else}<hx-code title={path}>
						{#if folder}<hx-span class="source-folder">{folder}</hx-span>{/if}<hx-span
							class="source-name">{folder ? '/' : ''}{name}</hx-span
						>
					</hx-code>{/if}
				{@render children(path)}
			</hx-li>
		{/each}
	</hx-ul>
{:else}<hx-p class="source-empty">{empty}</hx-p>{/if}

<style>
	.source-files {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.source-files li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--hx-space-8) var(--hx-space-16);
		padding: var(--hx-space-14) 0;
	}
	.source-files li + li {
		border-top: var(--hx-border-thin) solid var(--ex-line, var(--border));
	}
	.source-files a,
	.source-files code {
		min-width: 0;
		display: flex;
		white-space: nowrap;
		overflow: hidden;
		font: var(--hx-type-size-sm) var(--hx-font-family-code);
	}
	.source-folder {
		min-width: 0;
		flex: 0 1 auto;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.source-name {
		flex: 0 0 auto;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.source-files a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.source-files :global(.hx-action) {
		flex: 0 0 auto;
		min-height: var(--hx-space-28);
		padding: 0 var(--hx-space-8);
		gap: var(--hx-space-4);
		font-size: var(--hx-type-size-xs);
	}
	.source-files :global(.hx-action svg) {
		width: var(--hx-space-14);
		height: var(--hx-space-14);
	}
	@media (max-width: 480px) {
		.source-files li {
			grid-template-columns: minmax(0, 1fr);
			justify-items: start;
		}
		.source-files a,
		.source-files code {
			max-width: 100%;
		}
	}
	.source-empty {
		color: var(--ex-muted, var(--hx-color-text-muted));
	}
</style>
