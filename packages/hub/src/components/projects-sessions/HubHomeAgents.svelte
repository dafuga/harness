<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_aigdzmrsfg -->
<script lang="ts">
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeAgent,
		HomeChatInput,
		HomeChatReceipt,
		HomeOpenAsk
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import {
		agentGroups,
		agentActivity,
		agentLabels,
		currentAgent,
		runTime,
		initials,
		overviewTone
	} from './hubHomePresentation';
	import type { ChangeSession, SendHomeChat } from './hubHomeView.types';
	import HubHomeAddSession from './HubHomeAddSession.svelte';
	import HubHomeAsk from './HubHomeAsk.svelte';
	import HubHomeComposer from './HubHomeComposer.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let {
		agents: listed,
		asks = [],
		openAsks = [],
		added = [],
		changeSession,
		agentId,
		send,
		receipt,
		chatOpen = $bindable(false),
		chatName = $bindable('')
	}: {
		agents: HomeAgent[] | null;
		/** Other projects' agents that need you: not listed sessions, but their asks and options show. */
		asks?: HomeAgent[];
		openAsks?: HomeOpenAsk[];
		added?: string[];
		changeSession: ChangeSession;
		agentId?: string;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		chatOpen?: boolean;
		chatName?: string;
	} = $props();
	const agents = $derived(listed === null ? null : [...listed, ...asks]);
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
	<HubHomeAddSession {added} change={changeSession} />
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
											<hx-span class="po-item-meta">{agentActivity(agent)}</hx-span>
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
								</hx-li>
							{/each}
						</hx-ul>
					</hx-section>
				{/if}
			{/each}
			<HubHomeAddSession {added} change={changeSession} />
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
				{#each active.messages as message (message.id)}
					<hx-li class="hh-msg" data-from={message.from}>
						<hx-p>{message.text}</hx-p><hx-span class="hh-msg-at">{runTime(message.at)}</hx-span>
					</hx-li>
				{/each}
				{#each pending.filter((entry) => entry.message.agentId === active?.id && entry.message.itemId === active.itemId && !active.messages.some((message) => message.from === 'you' && message.text === entry.message.text)) as entry (entry.message.id)}
					<hx-li class="hh-msg" data-from="you">
						<hx-p>{entry.message.text}</hx-p><hx-span class="hh-msg-at" role="status"
							>{entry.receipt.status}</hx-span
						>
					</hx-li>
				{/each}
			</hx-ol>
			{#each openAsks.filter((ask) => ask.agentId === active?.id) as ask (ask.itemId)}
				<HubHomeAsk {ask} {send} {receipt} {submitted} />
			{/each}
			{#if active.itemId}
				{#key active.id}<HubHomeComposer {agents} agentId={active.id} {send} {submitted} />{/key}
			{:else}
				<hx-p class="po-sessions">This agent has no current Tracker item.</hx-p>
			{/if}
		</hx-section>
	</hx-div>
{/if}
