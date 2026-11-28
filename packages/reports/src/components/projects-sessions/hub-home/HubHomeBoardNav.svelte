<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ycw5bnav23 -->
<script lang="ts">
	import type { OpenHomeSection } from './hubHomeView.types';
	let { open }: { open: OpenHomeSection } = $props();
	const pages = [
		['projects', 'Projects'],
		['scheduled', 'Scheduled'],
		['plans', 'Plans']
	] as const;
</script>

<hx-nav class="hb-nav" aria-label="Pages">
	{#each pages as [section, label] (section)}
		<hx-button type="button" class="po-action" aria-haspopup="dialog" onclick={() => open(section)}
			>{label}</hx-button
		>
	{/each}
</hx-nav>
