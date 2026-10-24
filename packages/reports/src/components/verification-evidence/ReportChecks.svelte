<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Check } from '../../models/reports-media/Report.types';
	import { t } from '../../utils/reports-media/reportLocale';
	import StatusBadge from '../shared-primitives/StatusBadge.svelte';
	let { checks, embedded = false }: { checks: Check[]; embedded?: boolean } = $props();
</script>

<hx-section
	class:panel={!embedded}
	aria-labelledby={embedded ? undefined : 'checks-title'}
	aria-label={embedded ? $t('checks') : undefined}
>
	{#if !embedded}<hx-div class="section-heading">
			<hx-h2 id="checks-title">{$t('checks')}</hx-h2>
			<hx-span class="muted">{checks.length}</hx-span>
		</hx-div>{/if}
	{#if !checks.length}<hx-p class="muted">{$t('noChecks')}</hx-p>{/if}
	{#each checks as check (check.id)}
		<hx-article class="check" id={'check-' + check.id}>
			<hx-div class="check-heading">
				<hx-strong>{check.title}</hx-strong><StatusBadge status={check.status} />
			</hx-div>
			{#if check.group}<hx-small>{check.group}</hx-small>{/if}
			{#if check.counts}<hx-p class="counts">
					{Object.entries(check.counts)
						.map(([key, value]) => `${key}: ${value}`)
						.join(' · ')}
				</hx-p>{/if}
			{#if check.command || check.output}<hx-details>
					<hx-summary>{$t('details')}</hx-summary>
					{#if check.command}<hx-pre><hx-code>{check.command}</hx-code></hx-pre>{/if}
					{#if check.output}<hx-pre>{check.output}</hx-pre>{/if}
				</hx-details>{/if}
		</hx-article>
	{/each}
</hx-section>
