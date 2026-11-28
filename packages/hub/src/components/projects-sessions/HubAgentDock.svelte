<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_dk1w8fzq6k -->
<!-- @harness-uid u_h745y6xina -->
<script lang="ts">
	import { page } from '$app/state';
	import HubDock from '$reports/components/projects-sessions/hub-home/HubDock.svelte';
	import { provideHubSpecDocuments } from '$reports/components/projects-sessions/hub-home/hubSpecDocument';
	import { hubHomeSource } from './hubHomeSource.svelte';

	const source = hubHomeSource();
	provideHubSpecDocuments(source.readDocument);
</script>

<!-- Only the owner, or an account with a computer that answers, has agents to show. -->
{#if source.snapshot}
	<hx-div class="hd-band" aria-hidden="true"></hx-div>
	<HubDock
		source={source.snapshot}
		now={source.now}
		send={source.send}
		receipt={source.receipt}
		followScheme={page.route.id === '/'}
	/>
{/if}
