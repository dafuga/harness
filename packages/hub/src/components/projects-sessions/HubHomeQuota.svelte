<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_jn5w4wj4m5 -->
<script lang="ts">
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import type { HomeSubscription } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { missingQuotaProviders } from './hubHomePresentation';
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
	<EmptyState as="div" className="po-empty hh-empty">
		<hx-p
			>{connected
				? 'No subscriptions connected. Connect Claude Code or Codex and Harness reads how much usage is left, and when it resets.'
				: 'Provider quota is unknown.'}</hx-p
		>
		<hx-button type="button" class="po-action" onclick={reload}>Check for readings</hx-button>
	</EmptyState>
{:else}
	<hx-div class="hh-q-panels">
		{#each quota as subscription (subscription.id)}
			<HubQuotaSubscription {subscription} {now} detailed {reload} />
		{/each}
		<hx-div class="po-empty hh-empty hh-q-add">
			<hx-p
				><hx-strong class="hh-q-add-title">Add a subscription</hx-strong> Another Claude or OpenAI account
				appears once its computer adds it to the owner quota file.</hx-p
			>
			<hx-button type="button" class="po-action" onclick={reload}>Check for readings</hx-button>
		</hx-div>
	</hx-div>
	{#each missingQuotaProviders(quota) as provider (provider)}
		<hx-p class="po-sessions">{provider} quota is unknown.</hx-p>
	{/each}
{/if}
