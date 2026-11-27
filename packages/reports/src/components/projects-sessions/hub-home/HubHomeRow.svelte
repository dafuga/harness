<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
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
		trailing,
		activate
	}: {
		title: string;
		meta?: string;
		extra?: boolean;
		wide?: boolean;
		lead?: Snippet;
		trailing?: Snippet;
		activate?: (trigger: HTMLElement) => void;
	} = $props();
</script>

<hx-li class="po-item" data-extra={extra ? '' : undefined} data-wide={wide ? '' : undefined}>
	<hx-div class="hh-row" class:hh-row-target={Boolean(activate)}>
		{@render lead?.()}
		<hx-span class="po-item-text">
			<hx-span class="po-item-title"><LinkifiedText text={title} /></hx-span>
			{#if meta}<hx-span class="po-item-meta"><LinkifiedText text={meta} /></hx-span>{/if}
		</hx-span>
		{@render trailing?.()}
		{#if activate}
			<hx-button
				type="button"
				class="hh-open-row"
				aria-label={title}
				aria-haspopup="dialog"
				onclick={(event) => activate?.(event.currentTarget)}
			></hx-button>
		{/if}
	</hx-div>
</hx-li>
