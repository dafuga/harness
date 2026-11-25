<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_aigdzmrsfg -->
<script lang="ts">
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
		quickReplies
	} from './hubHomePresentation';
	import type { SendHomeChat } from './hubHomeView.types';
	import HubHomeChoices from './HubHomeChoices.svelte';
	import HubHomeComposer from './HubHomeComposer.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let {
		agents,
		agentId,
		send,
		receipt,
		chatOpen = $bindable(false),
		chatName = $bindable('')
	}: {
		agents: HomeAgent[] | null;
		agentId?: string;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		chatOpen?: boolean;
		chatName?: string;
	} = $props();
	let selected = $state<string>();
	let answer = $state('');
	let answering = $state(false);
	let status = $state('');
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
		answer = '';
		status = '';
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

	async function submitAnswer(event: SubmitEvent) {
		event.preventDefault();
		await answerWith(answer);
	}

	async function pickOption(number: number, confirmed: boolean) {
		const option = active?.options?.[number - 1];
		if (option) await answerWith(option.label, { number, confirmed });
	}

	async function answerWith(text: string, tap?: { number: number; confirmed: boolean }) {
		if (!active?.itemId || !active.question || !text.trim() || answering) return;
		const message: HomeChatInput = {
			id: crypto.randomUUID(),
			agentId: active.id,
			itemId: active.itemId,
			kind: 'answer',
			question: active.question,
			text: text.trim(),
			...(tap && { option: tap.number, ...(tap.confirmed && { confirmed: true as const }) })
		};
		answering = true;
		try {
			const result = await send(message);
			submitted(message, result);
			if (result.status === 'queued' || result.status === 'sent') answer = '';
		} catch {
			status = 'Could not queue the answer. Check Tracker before retrying.';
		} finally {
			answering = false;
		}
	}
</script>

{#if agents === null}
	<HubHomeSkeleton rows={6} />
{:else if !agents.length || !active}
	<EmptyState as="div" className="po-empty hh-empty">No agents are available.</EmptyState>
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
			{#if active.question}
				<HubHomeChoices agent={active} busy={answering} onpick={pickOption} />
				<hx-div class="hh-quick-replies" role="group" aria-label="Quick replies">
					{#each active.options?.length ? [] : quickReplies(active.question) as reply, index (reply)}
						<hx-button
							type="button"
							class={index ? 'po-action' : 'po-action hh-primary'}
							disabled={answering}
							onclick={() => answerWith(reply)}>{reply}</hx-button
						>
					{/each}
				</hx-div>
				<hx-form class="hh-quick" onsubmit={submitAnswer}>
					<hx-input
						aria-label="Answer to open question"
						placeholder="Answer the open question…"
						maxlength={2000}
						bind:value={answer}
					/>
					<hx-button
						type="submit"
						class="po-action hh-primary"
						disabled={answering || !answer.trim()}>Answer</hx-button
					>
				</hx-form>
			{/if}
			{#if status}<hx-p role="status">{status}</hx-p>{/if}
			{#if active.itemId}
				{#key active.id}<HubHomeComposer {agents} agentId={active.id} {send} {submitted} />{/key}
			{:else}
				<hx-p class="po-sessions">This agent has no current Tracker item.</hx-p>
			{/if}
		</hx-section>
	</hx-div>
{/if}
