<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_aigdzmrsfg -->
<script lang="ts">
	import { homeCosChat } from './hubHomeChatContext.svelte';
	import { hasWebLink } from '$reports/utils/strings/linkSegments';
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import {
		agentGroups,
		agentActivity,
		agentLabels,
		currentAgent,
		runTime,
		initials,
		overviewTone,
		messageStatusText
	} from './hubHomePresentation';
	import {
		isPending,
		receiptText
	} from './hubHomeMessages';
	import type { ChangeSession, SendHomeChat } from './hubHomeView.types';
	import HubHomeAddSession from './HubHomeAddSession.svelte';
	import HubHomeComposer from './HubHomeComposer.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let {
		agents,
		added = [],
		changeSession,
		agentId,
		send,
		receipt,
		chatOpen = $bindable(false),
		chatName = $bindable('')
	}: {
		agents: HomeAgent[] | null;
		added?: string[];
		changeSession?: ChangeSession;
		agentId?: string;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		chatOpen?: boolean;
		chatName?: string;
	} = $props();
	const cosChat = homeCosChat();
	let selected = $state<string>();
	let pending = $state<{ message: HomeChatInput; receipt: HomeChatReceipt }[]>([]);
	const active = $derived(
		agents?.find((agent) => agent.id === (selected ?? agentId)) ??
			currentAgent(agents ?? []) ??
			agents?.[0]
	);
	$effect(() => void (chatName = active?.name ?? ''));
	function select(id: string) {
		selected = id;
		chatOpen = true;
	}

	function submitted(message: HomeChatInput, result: HomeChatReceipt) {
		pending = [...pending, { message, receipt: result }];
	}

	$effect(() => {
		const timer = setInterval(() => {
			for (const entry of pending.filter((entry) => entry.receipt.status === 'queued')) {
				void receipt(entry.message.id).then(
					(value) => {
						entry.receipt = value;
					},
					() => {}
				);
			}
		}, 2000);
		return () => clearInterval(timer);
	});
</script>

{#if agents === null}
	<HubHomeSkeleton rows={6} />
{:else if !agents.length || !active}
	<EmptyState as="div" className="po-empty hh-empty">No agents are available.</EmptyState>
	{#if changeSession}<HubHomeAddSession {added} change={changeSession} />{/if}
{:else}
	<hx-div class="hh-split hh-split-agents" class:hh-show-detail={chatOpen}>
		<hx-div class="hh-split-list">
			{#each agentGroups as group (group)}
				{@const members = agents.filter((agent) => agent.state === group)}
				{#if members.length}
					<hx-section class="hh-group">
						<hx-h3 class="po-band-title"
							>{agentLabels[group]} <hx-span class="po-band-count">{members.length}</hx-span></hx-h3
						>
						<hx-ul class="po-items">
							{#each members as agent (agent.id)}
								{@const activity = agentActivity(agent)}
								{@const linkedActivity = hasWebLink(activity)}
								<hx-li
									class="po-item hh-agent-row"
									aria-current={active.id === agent.id ? 'true' : undefined}
								>
									<hx-button
										type="button"
										class="po-item-open hh-agent"
										onclick={() => select(agent.id)}
									>
										<hx-span class="hh-avatar" data-state={agent.state} aria-hidden="true"
											>{initials(agent.name)}</hx-span
										>
										<hx-span class="po-item-text">
											<hx-span class="po-item-title">{agent.name}</hx-span>
											{#if !linkedActivity}<hx-span class="po-item-meta">{activity}</hx-span>{/if}
											<hx-span class="po-item-meta hh-agent-where"
												>{[agent.machine, agent.model].filter(Boolean).join(' · ')}</hx-span
											>
										</hx-span>
										<Pill
											tone={`hh-tone po-state po-${overviewTone(agent.state)}`}
											state={overviewTone(agent.state)}
											><hx-span class="po-mark" aria-hidden="true"></hx-span>{agentLabels[
												agent.state
											]}</Pill
										>
									</hx-button>
									{#if linkedActivity}<hx-p class="po-item-meta hh-agent-linked-meta"
											><LinkifiedText text={activity} /></hx-p
										>{/if}
								</hx-li>
							{/each}
						</hx-ul>
					</hx-section>
				{/if}
			{/each}
			{#if changeSession}<HubHomeAddSession {added} change={changeSession} />{/if}
		</hx-div>
		<hx-section class="hh-chat" aria-label={`Chat with ${active.name}`}>
			<hx-header class="hh-chat-head">
				<hx-span class="hh-avatar" data-state={active.state} aria-hidden="true"
					>{initials(active.name)}</hx-span
				>
				<hx-div
					><hx-h3 class="po-name">{active.name}</hx-h3>
					<hx-p class="po-sessions"
						>{[active.machine, active.model].filter(Boolean).join(' · ')}</hx-p
					>
				</hx-div>
				<Pill
					tone={`hh-tone po-state po-${overviewTone(active.state)}`}
					state={overviewTone(active.state)}
					><hx-span class="po-mark" aria-hidden="true"></hx-span>{agentLabels[active.state]}</Pill
				>
			</hx-header>
			<hx-ol class="hh-thread" aria-label="Tracker conversation">
				{#each active.messages.filter((message) => message.id !== 'question') as message (message.id)}
					{@const status = messageStatusText(message, active.name)}
					<hx-li class="hh-msg" data-from={message.from} data-status={message.status}>
						<hx-p><LinkifiedText text={message.text} /></hx-p><hx-span class="hh-msg-at"
							>{status ? `${status} · ${runTime(message.at)}` : runTime(message.at)}</hx-span
						>
					</hx-li>
				{/each}
				{#each pending.filter((entry) => isPending(entry, active)) as entry (entry.message.id)}
					<hx-li class="hh-msg" data-from="you">
						<hx-p><LinkifiedText text={entry.message.text} /></hx-p><hx-span
							class="hh-msg-at"
							role="status">{receiptText(entry.receipt)}</hx-span
						>
					</hx-li>
				{/each}
			</hx-ol>
			{#if active.id === 'cos'}
				{#if cosChat}
					<hx-button
						type="button"
						class="po-action"
						aria-haspopup="dialog"
						onclick={(event) => cosChat.open(event.currentTarget)}>Open chat</hx-button
					>
				{/if}
			{:else if active.itemId}
				{#key active.id}<HubHomeComposer {agents} agentId={active.id} {send} {submitted} />{/key}
			{:else}
				<hx-p class="po-sessions">This agent has no current Tracker item.</hx-p>
			{/if}
		</hx-section>
	</hx-div>
{/if}
