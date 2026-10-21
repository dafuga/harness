<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		files,
		href,
		children
	}: {
		files: string[];
		href: (path: string) => string | undefined;
		children: Snippet<[string]>;
	} = $props();
</script>

{#if files.length}
	<ul class="source-files" aria-label="Source files">
		{#each files as path (path)}
			{@const url = href(path)}
			<li>
				{#if url}<a href={url} target="_blank" rel="noreferrer">{path}</a>
				{:else}<code>{path}</code>{/if}
				{@render children(path)}
			</li>
		{/each}
	</ul>
{:else}<p class="source-empty">No source files recorded at this revision.</p>{/if}

<style>
	.source-files {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.source-files li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 0;
	}
	.source-files li + li {
		border-top: 1px solid var(--ex-line, var(--border));
	}
	.source-files a,
	.source-files code {
		min-width: 0;
		overflow-wrap: anywhere;
		font:
			0.9rem ui-monospace,
			SFMono-Regular,
			Menlo,
			monospace;
	}
	.source-files a {
		color: inherit;
		text-underline-offset: 3px;
	}
	.source-files :global(.hx-action) {
		flex: 0 0 auto;
	}
	.source-empty {
		color: var(--ex-muted, var(--muted));
	}
</style>
