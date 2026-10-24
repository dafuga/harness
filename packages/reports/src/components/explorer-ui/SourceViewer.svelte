<script lang="ts">
	import type { SourceState } from '../../lib/explorer-ui/stores/sourceReader.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import Select from '../shared-primitives/Select.svelte';
	let {
		state,
		commit,
		empty = 'No source files recorded at this revision.',
		onSelect
	}: {
		state: SourceState;
		/** The revision the files were archived at; its short hash is shown on its own. */
		commit: string;
		/** What is said when the revision records no file. */
		empty?: string;
		onSelect: (path: string) => void;
	} = $props();
	// An empty file is a file: once it is read, its code is shown, empty.
	let readable = $derived(state.path !== '' && !state.loading && !state.error);
</script>

<div class="source-viewer" data-harness-component="source-viewer">
	<div class="source-bar">
		{#if state.files.length}
			<Select label="Source file" compact bind:value={() => state.path, onSelect}>
				{#each state.files as path (path)}<option value={path}>{path}</option>{/each}
			</Select>
		{/if}
		{#if commit}
			<span class="source-commit" title={commit}>
				<HarnessIcon name="commit" size={16} /><span>Commit</span><code>{commit.slice(0, 7)}</code>
			</span>
		{/if}
	</div>
	{#if state.loading}<p class="source-note" role="status">Loading source…</p>
	{:else if state.error}<p class="source-error" role="alert">{state.error}</p>
	{:else if state.files.length === 0}<p class="source-note">{empty}</p>{/if}
	<!-- The text is the file and nothing else: no line numbers and no markup are added to it. -->
	{#if readable}<pre class="source-code"><code>{state.text}</code></pre>{/if}
</div>

<style>
	.source-viewer {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--hx-space-12);
		min-width: 0;
	}
	.source-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--hx-space-8) var(--hx-space-16);
		min-width: 0;
	}
	.source-bar > :global(.report-select) {
		flex: 1 1 220px;
	}
	.source-commit {
		display: inline-flex;
		align-items: center;
		gap: var(--hx-space-6);
		margin-inline-start: auto;
		color: var(--ex-muted, var(--hx-color-text-muted));
		font-size: var(--hx-type-size-sm);
	}
	.source-commit code {
		color: var(--ex-text, inherit);
		font-family: var(--hx-font-family-code);
	}
	.source-note,
	.source-error {
		margin: 0;
		color: var(--ex-muted, var(--hx-color-text-muted));
	}
	.source-error {
		color: var(--ex-fail, var(--hx-color-error));
	}
	/* A long line scrolls inside the code, never the page or the dialog around it. */
	.source-viewer .source-code {
		max-width: 100%;
		max-height: min(65vh, 720px);
		margin: 0;
		padding: var(--hx-space-14) var(--hx-space-16);
		overflow: auto;
		border: var(--hx-border-thin) solid
			var(--ex-line, var(--hx-color-border, var(--hx-color-border)));
		border-radius: var(--hx-radius-small);
		background: var(--ex-raised, var(--hx-color-background));
		color: var(--ex-text, var(--hx-color-text));
		white-space: pre;
		tab-size: 2;
		font: var(--hx-style-code);
	}
	.source-code code {
		font: inherit;
	}
</style>
