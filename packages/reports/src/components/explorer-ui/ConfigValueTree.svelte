<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts" module>
	import type { ConfigCollection } from './ConfigValueTree.module.types';

	import type { ConfigValueNode } from '../../../../../src/utils/explorer-ui/unitMetadata';
	import type { HarnessIconName } from '../../utils/explorer-ui/harnessIcons';
	/** The object or array a value is, if it is one. */
	export const collection = (node?: ConfigValueNode): ConfigCollection | undefined =>
		node?.kind === 'expression' ? undefined : node;
	const shapeIcon = (held: ConfigCollection): HarnessIconName =>
		held.kind === 'object' ? 'object' : 'array';
	/** What a collection holds, counted only where its source states it exactly. */
	function holds({ kind, count, schema }: ConfigCollection): string {
		const one = kind === 'object' ? 'attribute' : 'item';
		if (count !== undefined) return `${count} ${one}${count === 1 ? '' : 's'}`;
		if (kind === 'array' && schema) return 'Array schema';
		return kind === 'object' ? 'Object' : 'Array';
	}
	/** The mark of a value opened whole: its shape and what it holds, or its size as written. */
	export function valueMark(node: ConfigValueNode | undefined, text: string) {
		const held = collection(node);
		if (held) return { icon: shapeIcon(held), size: holds(held) };
		const lines = text.split(/\r?\n/).length;
		// A short expression is shown as written, with nothing to open.
		if (lines === 1 && text.length <= 48) return undefined;
		const size = lines > 1 ? `${lines} lines` : `${text.length} chars`;
		return { icon: 'code' as const, size };
	}

	export type { ConfigCollection } from './ConfigValueTree.module.types';
</script>

<script lang="ts">
	import HarnessIcon from './HarnessIcon.svelte';
	let {
		node
	}: {
		/** A committed value as its source states it: read, never run. */
		node: ConfigValueNode;
	} = $props();
</script>

{#snippet shape(held: ConfigCollection)}
	<HarnessIcon name={shapeIcon(held)} size={16} />
	<hx-span class="ex-note">{holds(held)}</hx-span>
{/snippet}

<!-- An expression, or a collection whose entries are not listed, is shown as written. -->
{#snippet contents(value: ConfigValueNode)}
	{#if value.kind === 'expression' || (!value.entries.length && value.count !== 0)}
		<hx-code class="ex-value-code">{value.source}</hx-code>
	{:else if value.entries.length}
		<hx-ul class="ex-value-entries">
			{#each value.entries as entry, position (position)}
				<hx-li>{@render item(entry.name, entry.node)}</hx-li>
			{/each}
		</hx-ul>
	{/if}
{/snippet}

<!-- A collection with entries opens on request; anything else is one line under its key. -->
{#snippet item(name: string, value: ConfigValueNode)}
	{#if value.kind !== 'expression' && value.entries.length}
		<hx-details>
			<hx-summary class="ex-value-line"
				><hx-code class="ex-value-key">{name}</hx-code> {@render shape(value)}</hx-summary
			>
			<hx-div class="ex-value-nested">{@render contents(value)}</hx-div>
		</hx-details>
	{:else}
		<hx-div class="ex-value-line">
			<hx-code class="ex-value-key">{name}</hx-code>
			{#if value.kind !== 'expression'}{@render shape(value)}{/if}
			{@render contents(value)}
		</hx-div>
	{/if}
{/snippet}

<hx-section
	class="ex-value-tree"
	aria-label="Value contents"
	data-harness-component="explorer-ui-config-value-tree"
>
	{#if node.kind !== 'expression'}<hx-p class="ex-value-line">{@render shape(node)}</hx-p>{/if}
	{@render contents(node)}
</hx-section>

<style>
	/* The same raised panel as the source expression, so the two read as one value. */
	.ex-value-tree {
		display: grid;
		gap: var(--hx-space-6);
		min-width: 0;
		padding: var(--hx-space-10) var(--hx-space-16);
		border-radius: var(--hx-radius-small);
		background: var(--ex-raised);
	}
	/* Room for each disclosure marker, so every key lines up whether or not it opens. */
	.ex-value-entries {
		display: grid;
		gap: var(--hx-space-2);
		padding-left: var(--hx-space-18);
	}
	.ex-value-entries > li {
		margin: 0;
		line-height: var(--hx-style-leading-normal);
	}
	.ex-value-nested {
		margin: var(--hx-space-2) 0 var(--hx-space-6) var(--hx-space-4);
		border-left: var(--hx-border-thin) solid var(--ex-line);
	}
	.ex-value-line {
		padding: var(--hx-space-4) 0;
		color: var(--ex-text);
		font-size: inherit;
	}
	summary.ex-value-line {
		width: fit-content;
		max-width: 100%;
		list-style-position: outside;
	}
	/* Key, shape, count and value run on one line, each a space and a little margin apart. */
	.ex-value-tree :global(.hx-icon) {
		display: inline-block;
		margin-right: var(--hx-space-2);
		vertical-align: -3px;
	}
	.ex-value-line .ex-note {
		display: inline;
		margin: 0 var(--hx-space-4) 0 0;
		white-space: nowrap;
	}
	/* A long key breaks on a narrow screen rather than pushing the panel sideways. */
	.ex-value-key {
		margin-right: var(--hx-space-4);
		font-weight: var(--hx-style-weight-semibold);
		overflow-wrap: anywhere;
	}
	/* Long expressions wrap where they must, keeping the breaks they were written with. */
	.ex-value-code {
		color: var(--ex-soft);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
