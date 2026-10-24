<script lang="ts">
	import type { Evidence } from '../../models/reports-media/Report.types';
	let { item }: { item: Evidence } = $props();
</script>

{#if item.provenance?.length}
	<dl class="evidence-provenance" data-harness-component="evidence-provenance">
		{#each item.provenance as fact (fact.label)}
			<div>
				<dt>{fact.label}</dt>
				<dd>{fact.value}</dd>
			</div>
		{/each}
	</dl>
{/if}

<style>
	.evidence-provenance {
		display: grid;
		gap: var(--hx-space-4);
		margin: var(--hx-space-10) 0 0;
		font-size: var(--hx-type-size-xs);
		line-height: var(--hx-style-leading-normal);
		text-align: left;
		overflow-wrap: anywhere;
	}
	.evidence-provenance div {
		display: grid;
		grid-template-columns: minmax(0, 9.5em) minmax(0, 1fr);
		gap: var(--hx-space-8);
	}
	.evidence-provenance dt {
		color: var(--hx-color-text-muted, var(--hx-color-text-muted));
	}
	.evidence-provenance dd {
		margin: 0;
	}
	.evidence-provenance div:first-child dd {
		font-weight: var(--hx-style-weight-semibold);
	}
</style>
