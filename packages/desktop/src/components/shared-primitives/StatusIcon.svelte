<script lang="ts">
	import type { Verification } from '../../models/development-tooling/Desktop.types';
	let { status, reason }: { status: Verification; reason: string } = $props();
	let open = $state(false);
	const description = $derived(reason || 'No verification recorded for this revision.');
</script>

<span class="verification-wrap"
	><button
		class="verification"
		class:passed={status === 'verified'}
		aria-label={description}
		title={description}
		onclick={() => (open = true)}
		onblur={() => (open = false)}
		onfocus={() => (open = true)}
		onmouseenter={() => (open = true)}
		onmouseleave={() => (open = false)}>{status === 'verified' ? '✓' : '×'}</button
	>{#if open}<span class="reason" role="status">{description}</span>{/if}</span
>
