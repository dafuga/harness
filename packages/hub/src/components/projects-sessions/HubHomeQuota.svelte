<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_jn5w4wj4m5 -->
<script lang="ts">
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import type { HomeSubscription } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';
	import HubQuotaSubscription from './HubQuotaSubscription.svelte';
	let {
		quota,
		now,
		connected,
		reload
	}: { quota: HomeSubscription[] | null; now: number; connected: boolean; reload: () => void } =
		$props();
</script>

{#if quota === null}
	<HubHomeSkeleton rows={5} />
{:else if !quota.length}
	<EmptyState as="div" className="hh-empty">
		{connected ? 'No subscriptions connected.' : 'Provider readings are unavailable.'}
		<hx-button type="button" class="po-action" onclick={reload}>Check for readings</hx-button>
	</EmptyState>
{:else}
	<hx-div class="hh-q-panels">
		{#each quota as subscription (subscription.id)}
			<HubQuotaSubscription {subscription} {now} detailed {reload} />
		{/each}
	</hx-div>
{/if}
