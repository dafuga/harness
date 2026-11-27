<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_kgwre755vx -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import type { Snippet } from 'svelte';
	let {
		title,
		meta,
		extra = false,
		wide = false,
		lead,
		trailing
	}: {
		title: string;
		meta?: string;
		extra?: boolean;
		wide?: boolean;
		lead?: Snippet;
		trailing?: Snippet;
	} = $props();
</script>

<hx-li class="po-item" data-extra={extra ? '' : undefined} data-wide={wide ? '' : undefined}>
	<hx-div class="hh-row">
		{@render lead?.()}
		<hx-span class="po-item-text">
			<hx-span class="po-item-title"><LinkifiedText text={title} /></hx-span>
			{#if meta}<hx-span class="po-item-meta"><LinkifiedText text={meta} /></hx-span>{/if}
		</hx-span>
		{@render trailing?.()}
	</hx-div>
</hx-li>
