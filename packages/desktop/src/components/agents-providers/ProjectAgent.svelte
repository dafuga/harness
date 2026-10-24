<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import FloatingChat from '../../../../reports/src/components/FloatingChat.svelte';
	import { onMount, untrack } from 'svelte';
	import { createProjectAgentStore } from '../../lib/stores/agents-providers/projectAgent.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { visualCategory } from '../../utils/explorer-ui/composeModes';
	import Composer from '../shared-primitives/Composer.svelte';
	import ReferenceText from '../explorer-ui/reference-text/ReferenceText.svelte';
	import ChatAgents from './ChatAgents.svelte';
	let { workspace, open = $bindable(false) }: { workspace: Workspace; open?: boolean } = $props();
	// Rebuilt only for another project; the workspace itself is one object throughout.
	// svelte-ignore state_referenced_locally
	const agent = createProjectAgentStore(workspace);
	const kind = $derived(workspace.category.slice(0, -1));
	const label = $derived(agent.allowed ? 'Work with agent' : 'Open project chat');
	let view = $state<'chat' | 'agents'>('chat');
	onMount(() => agent.listen());
	$effect(() => {
		if (open && agent.allowed) untrack(() => agent.loadProviders());
	});
	const draft = $derived(
		agent.saved ? workspace.path(agent.saved.category, agent.saved.entityId) : ''
	);
	const quiet = $derived(!agent.messages.length && !agent.asked);
	function pending(author: 'user' | 'agent', text: string) {
		if (!agent.active) return false;
		const end = agent.messages.slice(-2);
		return Boolean(text) && !end.some((item) => item.author === author && item.text === text);
	}
</script>

{#snippet line(author: 'user' | 'agent', text: string)}<hx-li class="chat-message {author}">
		<hx-span class="chat-author">{author === 'user' ? 'You: ' : 'Agent: '}</hx-span><ReferenceText
			{text}
			{workspace}
			history
		/>
	</hx-li>{/snippet}

{#snippet tab(name: 'chat' | 'agents', text: string)}
	<hx-button type="button" aria-pressed={view === name} onclick={() => (view = name)}
		>{text}</hx-button
	>
{/snippet}

<!-- One conversation for the project; it stays open through entities, history and pinned commits. -->
<hx-div class="project-chat">
	<FloatingChat
		bind:open
		{label}
		panelLabel="Project agent"
		title="Project chat"
		notice={agent.notice}
		follow={view === 'chat'}
	>
		{#snippet navigation()}<hx-div class="chat-views">
				{@render tab('chat', 'Chat')}{@render tab('agents', 'Agents')}
			</hx-div>{/snippet}
		<hx-div class="chat-pane" hidden={view !== 'chat'}>
			<hx-div class="chat-thread">
				{#if quiet}<hx-p class="chat-note">No messages yet.</hx-p>{:else}<hx-ol class="chat-log">
						{#each agent.messages as message (message.id)}
							{@render line(message.author, message.text)}
						{/each}
						{#if pending('user', agent.asked)}{@render line('user', agent.asked)}{/if}
						{#if pending('agent', agent.said)}{@render line('agent', agent.said)}{/if}
					</hx-ol>{/if}
				{#if agent.status && (agent.active || !agent.messages
							.at(-1)
							?.text.includes(agent.status))}<hx-p class="chat-note chat-status" role="status">
						<hx-span><ReferenceText text={agent.status} {workspace} history /></hx-span>
						{#if agent.runId}<hx-button type="button" onclick={() => agent.cancel()}
								>Cancel</hx-button
							>{/if}
					</hx-p>{/if}
				{#if agent.error}<hx-p class="error" role="alert">{agent.error}</hx-p>{/if}
				{#if draft}<hx-p class="chat-note chat-status">
						<hx-span>A draft was saved without your request. Your text is kept here.</hx-span
						><hx-button type="button" onclick={() => workspace.navigate(draft)}
							>Open the saved draft</hx-button
						>
					</hx-p>{/if}
			</hx-div>
			<hx-div class="chat-compose">
				<Composer
					modes={agent.modes}
					visual={visualCategory(workspace.category)}
					compact
					providers={agent.providers}
					approved={agent.approved}
					running={agent.active || workspace.busy}
					placeholder={`Describe the ${kind} to add…`}
					comment={(text) => agent.comment(text)}
					send={agent.send}
				/>
			</hx-div>
		</hx-div>
		{#if open && view === 'agents'}{#key workspace.projectId}<ChatAgents {workspace} />{/key}{/if}
	</FloatingChat>
</hx-div>

<style>
	@import './project-agent/projectAgent.css';
</style>
