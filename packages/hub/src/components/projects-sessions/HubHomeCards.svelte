<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_koj2sfjf7g -->
<script lang="ts">
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import {
		agentLabels,
		count,
		initials,
		overviewTone,
		lowestLimit,
		missingQuotaProviders,
		providerNames,
		warningFor
	} from './hubHomePresentation';
	import HubHomeWorkCards from './HubHomeWorkCards.svelte';
	import type { HomeView, OpenHomeSection, SendHomeChat } from './hubHomeView.types';
	import HubHomeCard from './HubHomeCard.svelte';
	import HubHomeRow from './HubHomeRow.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';
	import HubHomeComposer from './HubHomeComposer.svelte';
	import HubQuotaSubscription from './HubQuotaSubscription.svelte';

	let { view, open, send }: { view: HomeView; open: OpenHomeSection; send: SendHomeChat } =
		$props();
	const working = $derived(view.agents?.filter((agent) => agent.state === 'working').length ?? 0);
	const warning = $derived(lowestLimit(view.quota ?? [], view.now));
	const attention = $derived(
		view.agents?.filter((agent) => agent.state === 'needs-you').length ?? 0
	);
</script>

{#snippet empty(text: string)}
	<EmptyState as="div" className="hh-empty">{text}</EmptyState>
{/snippet}

<hx-div class="hh-grid">
	<HubHomeCard
		section="agents"
		total={view.agents?.length}
		summary={view.agents === null
			? 'Loading agents…'
			: `${working} working · ${view.agents.length - working - attention} idle or offline`}
		open={() => open('agents')}
	>
		{#if view.agents === null}
			<HubHomeSkeleton />
		{:else if view.agents.length}
			<hx-ul class="po-items hh-agent-list">
				{#each view.agents.slice(0, 4) as agent, index (agent.id)}
					<HubHomeRow title={agent.name} meta={agent.task} extra={index >= 2}>
						{#snippet lead()}<hx-span class="hh-avatar" data-state={agent.state} aria-hidden="true"
								>{initials(agent.name)}</hx-span
							>{/snippet}
						{#snippet trailing()}
							<hx-span class="hh-agent-side">
								<Pill
									tone={`hh-tone po-state po-${overviewTone(agent.state)}`}
									state={overviewTone(agent.state)}
								>
									<hx-span class="po-mark" aria-hidden="true"></hx-span>{agentLabels[agent.state]}
								</Pill>
								<hx-button
									type="button"
									class="po-action hh-talk"
									onclick={() => open('agents', agent.id)}
									aria-label={`Message ${agent.name}`}>Message</hx-button
								>
							</hx-span>
						{/snippet}
					</HubHomeRow>
				{/each}
			</hx-ul>
		{:else}
			{@render empty(
				view.trackerConnected
					? 'No agents are connected.'
					: 'Tracker is unavailable for this account.'
			)}
		{/if}
		{#snippet badge()}
			{#if attention}<Pill tone="hh-tone po-state po-needs-you" state="needs-you"
					><hx-span class="po-mark" aria-hidden="true"></hx-span>{attention}
					{attention === 1 ? 'needs' : 'need'} you</Pill
				>{/if}
		{/snippet}
		{#snippet footer()}{#if view.agents}<HubHomeComposer
					agents={view.agents}
					{send}
				/>{/if}{/snippet}
	</HubHomeCard>

	<HubHomeCard
		section="quota"
		total={view.quota?.length}
		summary={view.quota === null
			? 'Reading subscriptions…'
			: !view.quotaConnected
				? 'Unknown'
				: warning
					? `Tightest: ${providerNames[warning.subscription.provider]} ${warning.limit.label.toLowerCase()}, ${warning.limit.left}% left`
					: count(view.quota.length, 'subscription')}
		open={() => open('quota')}
	>
		{#snippet badge()}
			{#if warning}
				<hx-span class="hh-q-flag" data-level={warningFor(warning.limit.left)}>
					<hx-span class="hh-q-mark" aria-hidden="true"></hx-span>{warningFor(
						warning.limit.left
					) === 'critical'
						? 'Almost out'
						: 'Running low'}
				</hx-span>
			{/if}
		{/snippet}
		{#if view.quota === null}
			<HubHomeSkeleton rows={2} />
		{:else if view.quota.length}
			<hx-div class="hh-q-preview">
				{#each view.quota.slice(0, 2) as subscription (subscription.id)}
					<HubQuotaSubscription {subscription} now={view.now} />
				{/each}
				{#if view.quota.length > 2}<hx-p class="po-more"
						>{count(view.quota.length - 2, 'more subscription')}</hx-p
					>{/if}
			</hx-div>
			{#each missingQuotaProviders(view.quota) as provider (provider)}
				<hx-p class="po-sessions">{provider} quota is unknown.</hx-p>
			{/each}
		{:else}
			{@render empty(
				view.quotaConnected ? 'No subscriptions connected.' : 'Provider quota is unknown.'
			)}
		{/if}
	</HubHomeCard>

	<HubHomeWorkCards {view} {open} />
</hx-div>
