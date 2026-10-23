<script lang="ts" module>
	import type { ConfigValueNode } from '../../../../../src/utils/explorer-ui/unitMetadata';
	import type { HarnessIconName } from '../../utils/explorer-ui/harnessIcons';
	/** A value that holds others: the attributes of an object or the items of an array. */
	export type ConfigCollection = Exclude<ConfigValueNode, { kind: 'expression' }>;
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
	<span class="ex-note">{holds(held)}</span>
{/snippet}

<!-- An expression, or a collection whose entries are not listed, is shown as written. -->
{#snippet contents(value: ConfigValueNode)}
	{#if value.kind === 'expression' || (!value.entries.length && value.count !== 0)}
		<code class="ex-value-code">{value.source}</code>
	{:else if value.entries.length}
		<ul class="ex-value-entries">
			{#each value.entries as entry, position (position)}
				<li>{@render item(entry.name, entry.node)}</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<!-- A collection with entries opens on request; anything else is one line under its key. -->
{#snippet item(name: string, value: ConfigValueNode)}
	{#if value.kind !== 'expression' && value.entries.length}
		<details>
			<summary class="ex-value-line"
				><code class="ex-value-key">{name}</code> {@render shape(value)}</summary
			>
			<div class="ex-value-nested">{@render contents(value)}</div>
		</details>
	{:else}
		<div class="ex-value-line">
			<code class="ex-value-key">{name}</code>
			{#if value.kind !== 'expression'}{@render shape(value)}{/if}
			{@render contents(value)}
		</div>
	{/if}
{/snippet}

<section
	class="ex-value-tree"
	aria-label="Value contents"
	data-harness-component="explorer-ui-config-value-tree"
>
	{#if node.kind !== 'expression'}<p class="ex-value-line">{@render shape(node)}</p>{/if}
	{@render contents(node)}
</section>

<style>
	/* The same raised panel as the source expression, so the two read as one value. */
	.ex-value-tree {
		display: grid;
		gap: 6px;
		min-width: 0;
		padding: 10px 16px;
		border-radius: 8px;
		background: var(--ex-raised);
	}
	/* Room for each disclosure marker, so every key lines up whether or not it opens. */
	.ex-value-entries {
		display: grid;
		gap: 2px;
		padding-left: 18px;
	}
	.ex-value-entries > li {
		margin: 0;
		line-height: 1.5;
	}
	.ex-value-nested {
		margin: 2px 0 6px 4px;
		border-left: 1px solid var(--ex-line);
	}
	.ex-value-line {
		padding: 4px 0;
		color: var(--ex-text);
		font-size: inherit;
	}
	summary.ex-value-line {
		width: fit-content;
		max-width: 100%;
		list-style-position: outside;
	}
	.ex-value-tree :global(.hx-icon) {
		vertical-align: -3px;
	}
	.ex-value-key {
		font-weight: 600;
	}
	/* Long expressions wrap where they must, keeping the breaks they were written with. */
	.ex-value-code {
		color: var(--ex-soft);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
