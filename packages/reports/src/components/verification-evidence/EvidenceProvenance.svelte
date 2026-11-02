<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_uozo3smwt7 -->
<script lang="ts">
	import type { Evidence } from '../../models/reports-media/Report.types';
	import { t } from '../../utils/reports-media/reportLocale';
	import DetailList from '../shared-primitives/DetailList.svelte';
	import CodeLine from '../shared-primitives/CodeLine.svelte';
	let { item }: { item: Evidence } = $props();
	let facts = $derived(
		item.provenance?.length
			? item.provenance
			: [{ label: $t('provenance'), value: $t('noProvenance') }]
	);
</script>

<hx-div class="evidence-provenance" data-harness-component="evidence-provenance">
	<DetailList rows={facts} rowKey={(_fact, position) => position}>
		{#snippet label(fact: NonNullable<Evidence['provenance']>[number])}{fact.label}{/snippet}
		{#snippet children(fact: NonNullable<Evidence['provenance']>[number])}
			{#if /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(fact.value)}
				<CodeLine text={fact.value} />
			{:else}{fact.value}{/if}
		{/snippet}
	</DetailList>
</hx-div>

<style>
	.evidence-provenance {
		margin: var(--hx-space-10) 0 0;
		font-size: var(--hx-type-size-xs);
		line-height: var(--hx-style-leading-normal);
		text-align: left;
		overflow-wrap: anywhere;
	}
	.evidence-provenance :global(dl) {
		display: grid;
		gap: var(--hx-space-4);
	}
	.evidence-provenance :global(.detail-row) {
		display: grid;
		grid-template-columns: minmax(0, 9.5em) minmax(0, 1fr);
		gap: var(--hx-space-8);
	}
	.evidence-provenance :global(dt) {
		color: var(--hx-color-text-muted, var(--hx-color-text-muted));
	}
	.evidence-provenance :global(.detail-row:first-child dd) {
		font-weight: var(--hx-style-weight-semibold);
	}
</style>
