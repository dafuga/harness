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
		{#if report.acceptance.length}
			<hx-ul class="acceptance">
				{#each report.acceptance as criterion}<hx-li>{criterion}</hx-li>{/each}
			</hx-ul>
		{:else}<hx-p class="muted">{$t('noAcceptance')}</hx-p>{/if}
	{/if}
	{#if section !== 'acceptance'}
		{#if !embedded}<hx-h2>{$t('coverage')}</hx-h2>{/if}
		{#if report.coverage.length}
			{#each report.coverage as item (item.id)}
				<hx-div class="check">
					<hx-div class="check-heading">
						<hx-strong>{item.title}</hx-strong><StatusBadge status={item.status} />
					</hx-div>
					{#if item.viewport}<hx-small>{item.viewport}</hx-small>{/if}
					{#if item.detail}<hx-p>{item.detail}</hx-p>{/if}
				</hx-div>
			{/each}
		{:else}<hx-p class="muted">{$t('noCoverage')}</hx-p>{/if}
	{/if}
</hx-section>
