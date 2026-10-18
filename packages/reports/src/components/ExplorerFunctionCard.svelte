<script lang="ts">
	import { listed, type CatalogRow } from '../utils/entityCatalog';
	import { entityContract } from '../utils/entityContract';
	import { entityLens, type EntityNav } from '../utils/entityLens';
	import EntityLink from './harness/EntityLink.svelte';
	import HarnessIcon from './harness/HarnessIcon.svelte';
	import HarnessVerdict from './harness/HarnessVerdict.svelte';
	let { row, nav }: { row: CatalogRow; nav: EntityNav } = $props();
	const open = 'Open function';
	// The function and its tests, both at the branch and commit this list is shown at.
	let to = $derived(entityLens(nav.route, { category: 'functions', entity: row.id }));
	let tests = $derived(
		entityLens(nav.route, { category: 'functions', entity: row.id, tab: 'tests' })
	);
	// What the contract declares, in words; what a test observed is read on the Tests view only.
	let contract = $derived(
		entityContract(row.entity.unit, { category: 'functions' }).filter(
			(field) => field.label === 'Inputs' || field.label === 'Output'
		)
	);
</script>

<article class="ex-function-tile" aria-label={row.name}>
	<h2><EntityLink {to} {nav}>{row.name}</EntityLink></h2>
	<p class="ex-soft">{row.summary}</p>
	{#if row.shared || row.changed}
		<p class="ex-function-badges">
			{#if row.shared}<span class="ex-pill gold">Shared</span>{/if}
			{#if row.changed}<span class="ex-pill gold">Changed</span>{/if}
		</p>
	{/if}
	<div class="ex-function-contract">
		<h3>Contract</h3>
		<dl>
			{#each contract as field (field.label)}
				<div>
					<dt>{field.label}</dt>
					<dd title={field.value}>{field.value}</dd>
				</div>
			{/each}
		</dl>
	</div>
	<p class="ex-fact"><span><strong>Used by</strong> {listed(row.usedBy)}</span></p>
	<div class="ex-function-foot">
		<HarnessVerdict {...row.verdict} framed />
		<EntityLink
			to={tests}
			{nav}
			class="ex-link ex-function-tests"
			title="Observed inputs and outputs of its recorded tests">View tests</EntityLink
		>
		<EntityLink {to} {nav} class="hx-action gold ex-function-open" label={open} title={open}>
			<HarnessIcon name="arrow-right" size={18} />
		</EntityLink>
	</div>
</article>

<style>
	.ex-function-tile {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
		padding: 16px;
		border: 1px solid var(--ex-line);
		border-radius: var(--ex-radius);
		background: var(--ex-surface);
	}
	.ex-function-tile h2 {
		overflow-wrap: anywhere;
	}
	.ex-function-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	/* The declared contract is set apart from the facts around it and from observed results. */
	.ex-function-contract {
		display: grid;
		gap: 8px;
		padding: 10px 12px;
		border: 1px solid var(--ex-line);
		border-radius: 8px;
		background: var(--ex-raised);
	}
	.ex-function-contract dl {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 4px 12px;
		font-size: 0.92rem;
	}
	.ex-function-contract dl > div {
		display: contents;
	}
	.ex-function-contract dt {
		color: var(--ex-muted);
	}
	.ex-function-contract dd {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		color: var(--ex-text);
		overflow-wrap: anywhere;
	}
	.ex-function-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-top: auto;
	}
	.ex-function-foot :global(.ex-function-tests) {
		display: inline-flex;
		align-items: center;
		min-height: 36px;
	}
	.ex-function-foot :global(.ex-function-open) {
		margin-left: auto;
		width: 36px;
		height: 36px;
		min-height: 36px;
		padding: 8px;
	}
</style>
