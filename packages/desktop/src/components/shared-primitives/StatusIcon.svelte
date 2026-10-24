<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Verification } from '../../models/development-tooling/Desktop.types';
	let { status, reason }: { status: Verification; reason: string } = $props();
	let open = $state(false);
	const description = $derived(reason || 'No verification recorded for this revision.');
</script>

<hx-span class="verification-wrap"
	><hx-button
		class="verification"
		class:passed={status === 'verified'}
		aria-label={description}
		title={description}
		onclick={() => (open = true)}
		onblur={() => (open = false)}
		onfocus={() => (open = true)}
		onmouseenter={() => (open = true)}
		onmouseleave={() => (open = false)}>{status === 'verified' ? '✓' : '×'}</hx-button
	>{#if open}<hx-span class="reason" role="status">{description}</hx-span>{/if}</hx-span
>
