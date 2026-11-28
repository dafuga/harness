<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_prfhm7q2kd -->
<script lang="ts">
	import type { HomeProviderPreference } from '$reports/lib/projects-sessions/hub-home/hubHome.types';

	let { preference, now }: { preference?: HomeProviderPreference; now: number } = $props();
	const until = $derived(
		preference && now < Date.parse(preference.until)
			? new Date(preference.until).toLocaleString('en-GB', {
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit',
					timeZoneName: 'short'
				})
			: null
	);
</script>

{#if until}
	<hx-p class="po-totals hh-provider-preference" role="status" aria-label="Model provider">
		Claude only until {until}. Computer use stays on Codex.
	</hx-p>
{/if}
