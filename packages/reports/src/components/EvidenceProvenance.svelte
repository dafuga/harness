<script lang="ts">
	import type { Evidence } from '../models/Report.types';
	let { item }: { item: Evidence } = $props();
</script>

{#if item.provenance?.length}
	<dl class="evidence-provenance">
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
		gap: 4px;
		margin: 10px 0 0;
		font-size: 12px;
		line-height: 1.45;
		text-align: left;
		overflow-wrap: anywhere;
	}
	.evidence-provenance div {
		display: grid;
		grid-template-columns: minmax(0, 9.5em) minmax(0, 1fr);
		gap: 8px;
	}
	.evidence-provenance dt {
		color: var(--muted, #6b7280);
	}
	.evidence-provenance dd {
		margin: 0;
	}
	.evidence-provenance div:first-child dd {
		font-weight: 600;
	}
</style>
