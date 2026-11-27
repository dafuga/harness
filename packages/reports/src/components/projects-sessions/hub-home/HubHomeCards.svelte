<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_koj2sfjf7g -->
<!-- @harness-view overview -->
<script lang="ts">
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import {
		agentActivity,
		agentLabels,
		count,
		isWorking,
		agentSessions,
		currentAgent,
		initials,
		overviewTone,
		lowestLimit,
		lowSummary,
		missingQuotaProviders,
		providerNames,
		quotaReset,
		staleReading,
		warningFor,
		warningLabel
	} from './hubHomePresentation';
	import HubHomeWorkCards from './HubHomeWorkCards.svelte';
	import type { HomeCardsProps } from './hubHomeView.types';
	import HubHomeCard from './HubHomeCard.svelte';
	import HubHomeNeedsYou from './HubHomeNeedsYou.svelte';
	import HubHomeReminders from './HubHomeReminders.svelte';
	import { homeCosChat, provideHomeCosChat } from './hubHomeChatContext.svelte';
	import HubHomeCosChat from './HubHomeCosChat.svelte';
	import HubHomeRow from './HubHomeRow.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';
	import HubQuotaSubscription from './HubQuotaSubscription.svelte';
	let { view, open, send, receipt, needsOnly = false }: HomeCardsProps = $props();
	const cosChat = homeCosChat() ?? provideHomeCosChat();
	/** The chat opens in the Agents dialog on whoever needs you, as the old inline composer did. */
	const recipient = $derived(currentAgent(view.agents ?? []));
	const working = $derived(view.agents?.filter(isWorking).length ?? 0);
	const warning = $derived(lowestLimit(view.quota ?? [], view.now));
	const lows = $derived(
		(view.quota ?? [])
			.filter((subscription) => !staleReading(subscription.readAt, view.now))
			.flatMap((subscription) => subscription.limits.filter((limit) => warningFor(limit.left)))
	);
	const level = $derived(warning ? warningFor(warning.limit.left) : null);
	const sessions = $derived(
		view.agents?.reduce((sum, agent) => sum + agentSessions(agent), 0) ?? 0
	);
	const idle = $derived(
		view.agents?.filter((agent) => !isWorking(agent) && agent.state !== 'needs-you').length ?? 0
	);
</script>

{#snippet empty(text: string, action?: string, act?: () => void)}
	<EmptyState as="div" className="po-empty hh-empty"
		><hx-p>{text}</hx-p>
		{#if action && act}<hx-button type="button" class="po-action" onclick={act}>{action}</hx-button
			>{/if}
	</EmptyState>
{/snippet}
<HubHomeNeedsYou asks={view.openAsks} now={view.now} {send} {receipt} />
{#if view.reminders && !needsOnly}
	<HubHomeReminders reminders={view.reminders} now={view.now} {send} {receipt} />
{/if}
{#if view.agents && (view.owner || view.linkedComputers)}<HubHomeCosChat
		agent={view.agents.find((agent) => agent.id === 'cos')}
		now={new Date(view.now).toISOString()}
		asks={view.openAsks}
		{send}
		{receipt}
	/>{/if}
{#if needsOnly}
	{#if view.agents === null}<HubHomeSkeleton rows={3} />
	{:else if !view.trackerConnected}{@render empty('Tracker decisions could not be read.')}
	{:else if !view.openAsks.length}{@render empty('Nothing needs you right now.')}{/if}
{:else}
	<hx-div class="hh-grid">
		<HubHomeCard
			section="agents"
			total={view.agents?.length}
			summary={view.agents === null
				? 'Loading agents…'
				: !view.trackerConnected && !view.agents.length
					? 'No activity data'
					: !view.agents.length
						? 'No agents yet'
						: `${working} working${sessions ? ` (${count(sessions, 'session')})` : ''} · ${idle} idle or offline`}
			open={() => open('agents')}
		>
			{#if view.agents === null}
				<HubHomeSkeleton />
			{:else if view.agents.length}
				<hx-ul class="po-items hh-agent-list">
					{#each view.agents.slice(0, 4) as agent, index (agent.id)}
						<HubHomeRow title={agent.name} meta={agentActivity(agent)} extra={index >= 2}>
							{#snippet lead()}<hx-span
									class="hh-avatar"
									data-state={agent.state}
									aria-hidden="true">{initials(agent.name)}</hx-span
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
										onclick={(event) => {
											if (agent.id === 'cos') cosChat.open(event.currentTarget);
											else open('agents', agent.id);
										}}
										aria-haspopup="dialog"
										aria-label={agent.id === 'cos'
											? 'Open chat with Chief of Staff'
											: `Message ${agent.name}`}
										>{agent.id === 'cos' ? 'Open chat' : 'Message'}</hx-button
									>
								</hx-span>
							{/snippet}
						</HubHomeRow>
					{/each}
				</hx-ul>
			{:else if view.trackerConnected}
				<EmptyState as="div" className="po-empty hh-empty"
					><hx-p>No agents are connected. Start a session on any computer and it appears here.</hx-p
					>
					{#if !view.linkedComputers && view.connectMacHref}
						<hx-a class="po-action" href={view.connectMacHref} data-sveltekit-reload
							>Connect a computer</hx-a
						>
					{/if}
				</EmptyState>
			{:else}
				{@render empty('Agent activity appears when Tracker data is available.')}
			{/if}
			{#snippet footer()}{#if recipient}<hx-button
						type="button"
						class="po-action hh-message"
						aria-haspopup="dialog"
						onclick={() => open('agents', recipient.id)}>Message an agent</hx-button
					>{/if}{/snippet}
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
					{@const tone = level === 'critical' ? 'blocked' : 'needs-you'}
					<Pill tone={`hh-tone po-state po-${tone}`} state={tone}
						><hx-span class="po-mark" aria-hidden="true"></hx-span>{lowSummary(lows)}</Pill
					>
				{/if}
			{/snippet}
			{#if view.quota === null}
				<HubHomeSkeleton rows={2} />
			{:else if view.quota.length}
				<hx-div class="hh-q-preview">
					{#if warning && level === 'critical'}
						<hx-div class="po-callout hh-q-callout" data-kind="blocked" data-level="critical">
							<hx-div class="po-callout-head"
								><hx-span class="po-callout-label">{warningLabel(warning.limit)}</hx-span><hx-span
									class="po-callout-meta">{quotaReset(warning.limit.resetsAt, view.now)}</hx-span
								></hx-div
							>
							<hx-p class="po-callout-text"
								>{providerNames[warning.subscription.provider]}
								{warning.limit.label.toLowerCase()}: {warning.limit.left}% left.</hx-p
							>
						</hx-div>
					{/if}
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
					view.quotaConnected
						? 'No subscriptions reported yet. Connect Claude Code or Codex in the Harness Mac app to see how much usage is left.'
						: view.needsMac
							? 'Quota readings appear when your Mac shares them.'
							: view.native
								? 'Connected subscriptions could not be read.'
								: 'Connect subscriptions in the Harness Mac app.'
				)}
			{/if}
		</HubHomeCard>
		<HubHomeWorkCards {view} {open} />
	</hx-div>
{/if}
