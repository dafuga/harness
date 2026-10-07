<script lang="ts">
	import type { Report } from '../models/Report.types';
	import { t } from '../utils/reportLocale';
	import StatusBadge from './StatusBadge.svelte';
	let {
		report,
		section = 'all',
		embedded = false
	}: { report: Report; section?: 'all' | 'acceptance' | 'coverage'; embedded?: boolean } = $props();
</script>

<section class:panel={!embedded} aria-label={embedded ? $t(section) : undefined}>
	{#if section !== 'coverage'}
		{#if !embedded}<h2>{$t('acceptance')}</h2>{/if}
		<ul class="acceptance">
			{#each report.acceptance as criterion}<li>{criterion}</li>{/each}
		</ul>
	{/if}
	{#if section !== 'acceptance' && report.coverage.length}
		{#if !embedded}<h2>{$t('coverage')}</h2>{/if}
		{#each report.coverage as item (item.id)}
			<div class="check">
				<div class="check-heading">
					<strong>{item.title}</strong><StatusBadge status={item.status} />
				</div>
				{#if item.viewport}<small>{item.viewport}</small>{/if}
				{#if item.detail}<p>{item.detail}</p>{/if}
			</div>
		{/each}
	{/if}
</section>
