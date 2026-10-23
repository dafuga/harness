<script lang="ts">
	import HarnessAction from '../HarnessAction.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	let {
		name,
		source,
		literal,
		onview
	}: {
		/** The full name of the variable, carried by the action that opens its value. */
		name: string;
		/** The value exactly as committed. */
		source: string;
		/** The decoded literal; absent for a computed expression, which is never evaluated. */
		literal?: unknown;
		/** Opens the whole value as written. */
		onview: (event: MouseEvent) => void;
	} = $props();
	const scalar = (item: unknown) =>
		item === null || ['string', 'number', 'boolean'].includes(typeof item);
	const shown = (item: unknown) => (item === '' ? 'Empty string' : String(item));
	const count = (size: number) => `${size} ${size === 1 ? 'item' : 'items'}`;
	// A few short items read inline; a longer or nested list is previewed as it is written.
	let items = $derived(
		Array.isArray(literal) &&
			literal.length <= 10 &&
			literal.every(scalar) &&
			literal.map(shown).join('').length <= 96
			? literal
			: null
	);
	let text = $derived(typeof literal === 'string' ? literal : source);
	let lines = $derived(text.split(/\r?\n/));
	// Past one line or 48 characters a string or an expression is previewed, and opened whole.
	let long = $derived(lines.length > 1 || text.length > 48);
	let size = $derived(
		Array.isArray(literal)
			? count(literal.length)
			: lines.length > 1
				? `${lines.length} lines`
				: `${text.length} chars`
	);
</script>

<div class="cv" data-harness-part="config-value">
	{#if typeof literal === 'boolean'}
		<span class="pill" class:on={literal} role="img" aria-label={`Boolean ${literal}`}
			><HarnessIcon name={literal ? 'passed' : 'failed'} size={14} />{String(literal)}</span
		>
	{:else if typeof literal === 'number'}
		<span class="number" role="img" aria-label={`Number ${literal}`}>{literal}</span>
	{:else if literal === null}
		<span class="keyword" role="img" aria-label="Null">null</span>
	{:else if literal === ''}
		<span class="chip blank" role="img" aria-label="Empty string">Empty string</span>
	{:else if items}
		<ul class="items" aria-label={`Array, ${count(items.length)}`}>
			{#each items as item, index (index)}
				<li
					class="chip"
					class:number={typeof item === 'number'}
					class:keyword={item === null || typeof item === 'boolean'}
					class:blank={item === ''}
				>
					{shown(item)}
				</li>
			{:else}
				<li class="chip blank">Empty array</li>
			{/each}
		</ul>
	{:else if long}
		<!-- The first lines as written: what does not fit is cut at the edge, never rewritten. -->
		{#if typeof literal === 'string'}
			<span
				class="preview string"
				class:more={lines.length > 2}
				role="img"
				aria-label={`String ${literal}`}>{lines.slice(0, 2).join('\n')}</span
			>
		{:else}
			<code class="preview" class:more={lines.length > 2}>{lines.slice(0, 2).join('\n')}</code>
		{/if}
		<span class="ex-note">{size}</span>
		<HarnessAction tone="plain" label={`View value for ${name}`} onclick={onview}
			>View value</HarnessAction
		>
	{:else if typeof literal === 'string'}
		<span class="string" role="img" aria-label={`String ${literal}`}>{literal}</span>
	{:else}
		<code class="source">{source}</code>
	{/if}
</div>

<style>
	/* One value in its cell: a typed mark for a literal, the text as written for an expression. */
	.cv {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
		min-width: 0;
		line-height: 1.5;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0 10px 0 6px;
		border: 1px solid var(--ex-line-strong);
		border-radius: 999px;
		background: var(--ex-raised);
		color: var(--ex-soft);
		font-family: var(--hx-font-family-mono);
		font-size: var(--hx-type-size-sm);
	}
	.pill :global(.hx-icon) {
		color: var(--ex-muted);
	}
	.pill.on {
		border-color: color-mix(in srgb, var(--ex-pass) 45%, transparent);
		background: color-mix(in srgb, var(--ex-pass) 12%, transparent);
		color: var(--ex-pass);
	}
	.pill.on :global(.hx-icon) {
		color: inherit;
	}
	/* The items of a short list, each a chip that keeps the mark of its own type. */
	.items {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		min-width: 0;
	}
	.chip {
		padding: 0 8px;
		border: 1px solid var(--ex-line-strong);
		border-radius: var(--hx-radius-small);
		background: var(--ex-raised);
		color: var(--ex-text);
		font-size: var(--hx-type-size-sm);
		overflow-wrap: anywhere;
	}
	.chip.blank {
		border-style: dashed;
		background: transparent;
		color: var(--ex-muted);
		font-style: italic;
	}
	.number,
	.keyword,
	.source {
		font-family: var(--hx-font-family-mono);
		font-size: var(--hx-type-size-sm);
	}
	.number {
		color: var(--hx-accent);
		font-variant-numeric: tabular-nums;
	}
	.keyword {
		color: var(--ex-muted);
	}
	.string {
		color: var(--ex-text);
	}
	.string,
	.source {
		min-width: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.source {
		color: var(--ex-soft);
	}
	.preview {
		flex: 1 1 14rem;
		min-width: 0;
		overflow: hidden;
		white-space: pre;
		text-overflow: ellipsis;
	}
	.preview.more {
		mask-image: linear-gradient(black 45%, transparent);
	}
</style>
