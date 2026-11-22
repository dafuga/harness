<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_et5rodvng6 -->
<script lang="ts">
	import { etaFor, formatWhen, statusLabel } from './projectOverviewPresentation';
	import type { ProjectOverviewItemProps } from './ProjectOverviewItem.types';
	let { item, now, onOpen, extra = false }: ProjectOverviewItemProps = $props();
	const eta = $derived(etaFor(item.due, now));
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

<hx-li class="po-item" data-extra={extra ? '' : undefined}>
	<hx-button type="button" class="po-item-open" onclick={() => onOpen(item)}>
		<hx-span class="po-item-text">
			<hx-span class="po-item-title">{item.title}</hx-span>
			<hx-span class="po-item-meta">{meta}</hx-span>
		</hx-span>
		<hx-span class="po-eta" data-tone={eta.tone}>{eta.text}</hx-span>
	</hx-button>
</hx-li>
