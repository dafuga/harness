<script lang="ts">
	import type { Check } from '../models/Report.types';
	import { t } from '../utils/reportLocale';
	import StatusBadge from './StatusBadge.svelte';
	let { checks, embedded = false }: { checks: Check[]; embedded?: boolean } = $props();
</script>

<section
	class:panel={!embedded}
	aria-labelledby={embedded ? undefined : 'checks-title'}
	aria-label={embedded ? $t('checks') : undefined}
>
	{#if !embedded}<div class="section-heading">
			<h2 id="checks-title">{$t('checks')}</h2>
			<span class="muted">{checks.length}</span>
		</div>{/if}
	{#if !checks.length}<p class="muted">{$t('noChecks')}</p>{/if}
	{#each checks as check (check.id)}
		<article class="check" id={'check-' + check.id}>
			<div class="check-heading">
				<strong>{check.title}</strong><StatusBadge status={check.status} />
			</div>
			{#if check.group}<small>{check.group}</small>{/if}
			{#if check.counts}<p class="counts">
					{Object.entries(check.counts)
						.map(([key, value]) => `${key}: ${value}`)
						.join(' · ')}
				</p>{/if}
			{#if check.command || check.output}<details>
					<summary>{$t('details')}</summary>
					{#if check.command}<pre><code>{check.command}</code></pre>{/if}
					{#if check.output}<pre>{check.output}</pre>{/if}
				</details>{/if}
		</article>
	{/each}
</section>
