<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Evidence } from '../../models/reports-media/Report.types';
	import { evidenceMedia } from '../../utils/verification-evidence/evidenceMedia';
	import { t } from '../../utils/reports-media/reportLocale';
	import { timeAgo } from '../../utils/reports-media/reportDisplay';
	import AudioEvidence from './AudioEvidence.svelte';
	import AudioComparison from '../reports-media/AudioComparison.svelte';
	import EvidenceProvenance from './EvidenceProvenance.svelte';
	import StatusBadge from '../shared-primitives/StatusBadge.svelte';
	let {
		item,
		before,
		assetBase,
		compact = false,
		onopen
	}: {
		item: Evidence;
		before?: Evidence;
		assetBase: string;
		compact?: boolean;
		onopen: () => void;
	} = $props();
	let imageError = $state(false);
	let missing = $derived(Boolean(item.missing || imageError));
</script>

{#if evidenceMedia(item) === 'audio'}
	{#if before}<AudioComparison {before} after={item} {onopen} />{:else}<AudioEvidence
			{item}
			{assetBase}
		/>{/if}
{:else}
	<hx-article class="evidence-card" id={'evidence-' + item.id}>
		<hx-button
			class="image-button"
			onclick={onopen}
			disabled={missing}
			aria-label={$t('open', { values: { title: item.title } })}
		>
			{#if missing}<hx-span class="missing">{$t('missing')}</hx-span>
			{:else}<hx-img
					src={assetBase + item.file}
					alt={item.title}
					loading="lazy"
					onerror={() => (imageError = true)}
				/>{/if}
			{#if !missing}<hx-span class="view-hint">↗ {$t('fullSize')}</hx-span>{/if}
		</hx-button>
		{#if compact}
			<hx-details class="card-body">
				<hx-summary>Capture details</hx-summary><EvidenceProvenance {item} />
			</hx-details>
		{:else}<hx-div class="card-body">
				<hx-div class="card-kicker">
					<hx-span>{item.category}</hx-span><StatusBadge
						status={missing ? 'not-proven' : item.status}
					/>
				</hx-div>
				<hx-h3><hx-a href={'#evidence-' + item.id}>{item.title}</hx-a></hx-h3>
				{#if missing && item.note}<hx-p class="muted">{item.note}</hx-p>{/if}
				<EvidenceProvenance {item} />
				<hx-div class="evidence-meta">
					{#if item.viewport}<hx-span>{item.viewport}</hx-span>{/if}{#if item.capturedAt}<hx-time
							datetime={item.capturedAt}>{timeAgo(item.capturedAt)}</hx-time
						>{/if}
				</hx-div>
			</hx-div>{/if}
	</hx-article>
{/if}
