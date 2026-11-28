<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_dk4m7qzr2a -->
<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { tick } from 'svelte';
	import HarnessIcon from '$reports/components/explorer-ui/HarnessIcon.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeAgent,
		HomeChatReceipt,
		SendHomeChat
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { dockPillText, dockSummary, hubDockModel } from './hubDockModel';
	import type { HubDockSource } from './hubDockModel.types';
	import { initials } from './hubHomePresentation';
	import HubDockList from './HubDockList.svelte';
	import HubDockPick from './HubDockPick.svelte';
	import HubDockChat from './HubDockChat.svelte';
	import '$reports/lib/styles/home-scheme.css';
	import '$reports/lib/styles/project-overview-cards.css';
	import '$reports/lib/styles/project-overview-controls.css';
	import '$reports/lib/styles/hub-home/index.css';
	import '$reports/lib/styles/hub-home/dock.css';
	import '$reports/lib/styles/hub-home/dock-chat.css';

	let {
		source,
		now,
		send,
		receipt,
		followScheme = false
	}: {
		source: HubDockSource;
		now: number;
		send: SendHomeChat;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		/** Follows the visitor's color scheme; pages that are always dark keep the dock dark. */
		followScheme?: boolean;
	} = $props();

	type View = { name: 'list' } | { name: 'pick' } | { name: 'chat'; agentId: string };
	let isOpen = $state(false);
	let view = $state<View>({ name: 'list' });
	/** The agent as last seen, so an open chat stays when its agent leaves the list. */
	let held = $state.raw<HomeAgent | null>(null);
	let dialog = $state<HTMLDialogElement>();
	let launcher = $state<HTMLElement>();
	const phone = new MediaQuery('max-width: 560px');
	const model = $derived(hubDockModel(source, now));
	const pill = $derived(dockPillText(model));
	const chatId = $derived(view.name === 'chat' ? view.agentId : null);
	const chatAgent = $derived(
		[...source.agents, ...source.asks, ...model.reachable].find((agent) => agent.id === chatId) ??
			(held?.id === chatId ? held : null)
	);
	$effect(() => void (chatAgent && (held = chatAgent)));

	/** A sheet over the whole phone is modal; the desktop panel leaves the page usable. */
	$effect(() => {
		if (!isOpen || !dialog) return;
		const modal = phone.current;
		if (dialog.open) dialog.close();
		if (modal) dialog.showModal();
		else dialog.show();
	});

	async function show(next: View) {
		view = next;
		await tick();
		dialog?.querySelector<HTMLElement>('.hd-start')?.focus({ preventScroll: true });
	}

	function openDock() {
		isOpen = true;
		void show({ name: 'list' });
	}

	async function close() {
		isOpen = false;
		await tick();
		launcher?.focus({ preventScroll: true });
	}

	const chat = (agentId: string) => void show({ name: 'chat', agentId });

	/** With only Chief of Staff to write to, there is nothing to pick. */
	function compose() {
		if (model.reachable.length === 1) chat(model.reachable[0].id);
		else void show({ name: 'pick' });
	}

	function escape(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !(event.target instanceof Element)) return;
		// A dialog opened from the chat closes itself first.
		if (event.target.closest('dialog') !== dialog) return;
		event.preventDefault();
		event.stopPropagation();
		void close();
	}
</script>

<hx-div class="home-scheme">
	<hx-div class={followScheme ? 'home-page hh-home hd-root' : 'hh-home hd-root'}>
{#if !isOpen}
	<hx-div class="hd-bar">
		<hx-button
			bind:this={launcher}
			type="button"
			class="hd-launch"
			aria-haspopup="dialog"
			aria-label={pill ? `Agents, ${pill}` : 'Agents'}
			onclick={openDock}
		>
			{#if model.asking.length}
				<hx-span class="hd-stack" aria-hidden="true">
					{#each model.asking.slice(0, 3) as { agent } (agent.id)}
						<hx-span class="hd-avatar" data-state="needs-you">{initials(agent.name)}</hx-span>
					{/each}
				</hx-span>
			{/if}
			<hx-span class="hd-launch-name">Agents</hx-span>
			{#if pill}
				{@const tone = model.asking.length ? 'needs-you' : 'active'}
				<Pill tone={`hh-tone po-state po-${tone}`} state={tone}
					><hx-span class="po-mark" aria-hidden="true"></hx-span>{pill}</Pill
				>
			{/if}
			<hx-span class="hd-launch-go" aria-hidden="true">›</hx-span>
		</hx-button>
	</hx-div>
{:else}
	<hx-dialog
		bind:this={dialog}
		class="hd-panel"
		data-view={view.name}
		aria-label={chatAgent ? `Chat with ${chatAgent.name}` : 'Agents'}
		onkeydown={escape}
		oncancel={(event: Event) => {
			event.preventDefault();
			void close();
		}}
	>
		<hx-header class="hd-head">
			{#if view.name !== 'list'}
				<hx-button
					type="button"
					class="hd-icon hd-start"
					aria-label="Back to agents"
					onclick={() => show({ name: 'list' })}>‹</hx-button
				>
			{/if}
			{#if chatAgent}
				{@const asks = model.asking.some((entry) => entry.agent.id === chatAgent.id)}
				<hx-span
					class="hd-avatar"
					data-state={asks ? 'needs-you' : chatAgent.state}
					aria-hidden="true">{initials(chatAgent.name)}</hx-span
				>
			{/if}
			<hx-div class="hd-titles">
				{#if chatAgent}
					<hx-h2 class="hd-title">{chatAgent.name}</hx-h2>
					<hx-p class="hd-sub"
						>{[chatAgent.task, chatAgent.machine].filter(Boolean).join(' · ')}</hx-p
					>
				{:else if view.name === 'pick'}
					<hx-h2 class="hd-title">New conversation</hx-h2>
					<hx-p class="hd-sub">Choose who to write to</hx-p>
				{:else}
					<hx-h2 class="hd-title">Agents</hx-h2>
					<hx-p class="hd-sub">{dockSummary(model)}</hx-p>
				{/if}
			</hx-div>
			<hx-button
				type="button"
				class={view.name === 'list' ? 'hd-icon hd-start' : 'hd-icon'}
				aria-label="Close agents"
				onclick={close}><HarnessIcon name="close" size={20} /></hx-button
			>
		</hx-header>
		{#if chatAgent}
			{#key chatAgent.id}
				<HubDockChat agent={chatAgent} asks={source.openAsks} {now} {send} {receipt} />
			{/key}
		{:else if view.name === 'pick'}
			<HubDockPick agents={model.reachable} pick={chat} />
		{:else}
			<HubDockList {model} {now} pick={chat} />
			<hx-footer class="hd-foot">
				<hx-button type="button" class="po-action hh-primary hd-new" onclick={compose}
					>New conversation</hx-button
				>
			</hx-footer>
		{/if}
	</hx-dialog>
{/if}
	</hx-div>
</hx-div>
