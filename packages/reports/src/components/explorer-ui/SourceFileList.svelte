<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		files,
		label = 'Source files',
		empty = 'No source files recorded at this revision.',
		href,
		children
	}: {
		files: string[];
		label?: string;
		empty?: string;
		href: (path: string) => string | undefined;
		children: Snippet<[string]>;
	} = $props();
</script>

{#if files.length}
	<ul class="source-files" aria-label={label}>
		{#each files as path, position (position)}
			{@const url = href(path)}
			<li>
				{#if url}<a href={url} target="_blank" rel="noreferrer">{path}</a>
				{:else}<code>{path}</code>{/if}
				{@render children(path)}
			</li>
		{/each}
	</ul>
{:else}<p class="source-empty">{empty}</p>{/if}

<style>
	.source-files {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.source-files li {
		display: flex;
		flex-wrap: wrap;
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
		overflow-wrap: anywhere;
		font: var(--hx-type-size-sm) var(--hx-font-family-code);
	}
	.source-files a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.source-files :global(.hx-action) {
		flex: 0 0 auto;
	}
	.source-empty {
		color: var(--ex-muted, var(--hx-color-text-muted));
	}
</style>
