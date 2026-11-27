<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_et5rodvng6 -->
<script lang="ts">
	import { hasWebLink } from '../../../utils/strings/linkSegments';
	import LinkifiedText from '../../shared-primitives/LinkifiedText.svelte';
	import { etaFor, formatWhen, statusLabel } from './projectOverviewPresentation';
	import type { ProjectOverviewItemProps } from './ProjectOverviewItem.types';
	let { item, now, onOpen, extra = false }: ProjectOverviewItemProps = $props();
	const eta = $derived(etaFor(item, now));
	const meta = $derived(
		[
			statusLabel(item.status),
			item.live ? 'Live' : '',
			item.stale ? 'Stale' : '',
			`updated ${formatWhen(item.updatedAt)}`
		]
			.filter(Boolean)
			.join(' · ')
	);
</script>

{#snippet summary(linked: boolean)}
	<hx-span class="po-item-text">
		<hx-span class="po-item-title">
			{#if linked}<LinkifiedText text={item.title} />{:else}{item.title}{/if}
		</hx-span>
		<hx-span class="po-item-meta">{meta}</hx-span>
	</hx-span>
	<hx-span class="po-eta" data-tone={eta.tone}>{eta.text}</hx-span>
{/snippet}

<hx-li class="po-item" data-extra={extra ? '' : undefined}>
	{#if hasWebLink(item.title)}
		<hx-div class="po-item-open po-item-with-link">
			{@render summary(true)}
			<hx-button type="button" class="po-action" onclick={() => onOpen(item)}>Open item</hx-button>
		</hx-div>
	{:else}
		<hx-button type="button" class="po-item-open" onclick={() => onOpen(item)}>
			{@render summary(false)}
		</hx-button>
	{/if}
</hx-li>
