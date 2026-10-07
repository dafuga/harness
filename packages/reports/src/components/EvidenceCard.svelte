<script lang="ts">
	import type { Evidence } from '../models/Report.types';
	import { evidenceMedia } from '../utils/evidenceMedia';
	import { t } from '../utils/reportLocale';
	import { timeAgo } from '../utils/reportDisplay';
	import AudioEvidence from './AudioEvidence.svelte';
	import AudioComparison from './AudioComparison.svelte';
	import StatusBadge from './StatusBadge.svelte';
	let {
		item,
		before,
		assetBase,
		onopen
	}: { item: Evidence; before?: Evidence; assetBase: string; onopen: () => void } = $props();
	let imageError = $state(false);
	let missing = $derived(Boolean(item.missing || imageError));
</script>

{#if evidenceMedia(item) === 'audio'}
	{#if before}<AudioComparison {before} after={item} {onopen} />{:else}<AudioEvidence
			{item}
			{assetBase}
		/>{/if}
{:else}
	<article class="evidence-card" id={'evidence-' + item.id}>
		<button
			class="image-button"
			onclick={onopen}
			disabled={missing}
			aria-label={$t('open', { values: { title: item.title } })}
		>
			{#if missing}<span class="missing">{$t('missing')}</span>
			{:else}<img
					src={assetBase + item.file}
					alt={item.title}
					loading="lazy"
					onerror={() => (imageError = true)}
				/>{/if}
			{#if !missing}<span class="view-hint">↗ {$t('fullSize')}</span>{/if}
		</button>
		<div class="card-body">
			<div class="card-kicker">
				<span>{item.category}</span><StatusBadge status={missing ? 'not-proven' : item.status} />
			</div>
			<h3><a href={'#evidence-' + item.id}>{item.title}</a></h3>
			{#if missing && item.note}<p class="muted">{item.note}</p>{/if}
			<div class="evidence-meta">
				{#if item.viewport}<span>{item.viewport}</span>{/if}{#if item.capturedAt}<time
						datetime={item.capturedAt}>{timeAgo(item.capturedAt)}</time
					>{/if}
			</div>
		</div>
	</article>
{/if}
