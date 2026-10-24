<!-- @harness-tier organism -->
<!-- @harness-atoms atoms -->
<script lang="ts">
	import type { Report } from '../../models/reports-media/Report.types';
	import { t } from '../../utils/reports-media/reportLocale';
	import StatusBadge from './StatusBadge.svelte';
	let {
		report,
		section = 'all',
		embedded = false
	}: { report: Report; section?: 'all' | 'acceptance' | 'coverage'; embedded?: boolean } = $props();
</script>

<hx-section class:panel={!embedded} aria-label={embedded ? $t(section) : undefined}>
	{#if section !== 'coverage'}
		{#if !embedded}<hx-h2>{$t('acceptance')}</hx-h2>{/if}
		<hx-ul class="acceptance">
			{#each report.acceptance as criterion}<hx-li>{criterion}</hx-li>{/each}
		</hx-ul>
	{/if}
	{#if section !== 'acceptance' && report.coverage.length}
		{#if !embedded}<hx-h2>{$t('coverage')}</hx-h2>{/if}
		{#each report.coverage as item (item.id)}
			<hx-div class="check">
				<hx-div class="check-heading">
					<hx-strong>{item.title}</hx-strong><StatusBadge status={item.status} />
				</hx-div>
				{#if item.viewport}<hx-small>{item.viewport}</hx-small>{/if}
				{#if item.detail}<hx-p>{item.detail}</hx-p>{/if}
			</hx-div>
		{/each}
	{/if}
</hx-section>
