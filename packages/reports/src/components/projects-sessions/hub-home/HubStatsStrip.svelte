<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_jeymogffwf -->
<script lang="ts">
	import type { StripComputer } from './hubStripComputers.types';
	import type { StripCounts } from './hubStripCounts.types';
	import type { StripQuota } from './hubStripQuota.types';

	let {
		computers,
		quota,
		counts,
		compact = false,
		pressed = null,
		onsessions,
		onneedsyou
	}: {
		computers: StripComputer[];
		quota: StripQuota[];
		counts: StripCounts;
		/** iPhone layout: four number cells, then one chip per computer. */
		compact?: boolean;
		/** The tile whose board filter is on. */
		pressed?: 'sessions' | 'needs-you' | null;
		onsessions?: () => void;
		onneedsyou?: () => void;
	} = $props();
</script>

<hx-section class="hs-strip" aria-label="Overview" data-compact={compact}>
	<!-- Not built yet: {computers.length} computers, {quota.length} limits, {counts.sessions.value}, {pressed}, {Boolean(onsessions)}, {Boolean(onneedsyou)} -->
</hx-section>
