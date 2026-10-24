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
	.project-chat {
		--floating-chat-top: var(--hx-layout-bar-clearance);
		display: contents;
	}
	@media (max-width: 1409px) {
		.project-chat {
			--floating-chat-top: var(--hx-layout-bar-clearance-wrapped);
		}
	}
	@media (max-width: 1250px) {
		.project-chat {
			--floating-chat-top: var(--hx-layout-bar-clearance-stacked);
		}
	}
	@media (max-width: 560px) {
		.project-chat {
			--floating-chat-top: var(--hx-layout-bar-clearance-phone);
		}
	}
	/* Chat and Agents sit under the title, outside what scrolls; the hidden chat keeps its draft. */
	.chat-views {
		display: flex;
		gap: var(--hx-space-5);
		padding: var(--hx-space-8) var(--hx-space-14);
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border);
	}
	.chat-views button {
		padding: var(--hx-space-3) var(--hx-space-12);
		border: var(--hx-border-thin) solid transparent;
		border-radius: var(--hx-radius-round);
		background: none;
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-compact);
	}
	.chat-views button:hover {
		color: var(--hx-color-text);
	}
	.chat-views button[aria-pressed='true'] {
		border-color: color-mix(in srgb, var(--hx-color-primary) 45%, transparent);
		color: var(--hx-color-primary);
	}
	.chat-pane:not([hidden]) {
		display: contents;
	}
	.chat-thread {
		display: flex;
		flex-direction: column;
		gap: var(--hx-space-10);
	}
	.chat-log {
		display: grid;
		gap: var(--hx-space-8);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chat-message {
		max-width: 88%;
		padding: var(--hx-space-8) var(--hx-space-12);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-xlarge);
		font-size: var(--hx-type-size-sm);
		line-height: var(--hx-style-leading-normal);
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
	.chat-message.user {
		justify-self: end;
		border-end-end-radius: var(--hx-radius-xsmall);
		background: var(--hx-color-hover);
	}
	.chat-message.agent {
		justify-self: start;
		border-color: color-mix(in srgb, var(--hx-color-primary) 45%, transparent);
		border-end-start-radius: var(--hx-radius-xsmall);
	}
	/* Who said it is read out; the side of the conversation shows it. */
	.chat-author {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.chat-note,
	.error {
		margin: 0;
		font-size: var(--hx-type-size-compact);
	}
	.chat-note {
		color: var(--hx-color-text-muted);
	}
	.chat-status {
		display: flex;
		gap: var(--hx-space-10);
		justify-content: space-between;
		align-items: center;
	}
	.chat-status button {
		flex: none;
		padding: var(--hx-space-5) var(--hx-space-10);
	}
	.error {
		padding: var(--hx-space-8) var(--hx-space-12);
		border-radius: var(--hx-radius-small);
	}
	.chat-compose {
		position: sticky;
		bottom: 0;
		margin-top: auto;
		padding: var(--hx-space-2) 0 var(--hx-space-14);
		background: var(--hx-color-surface);
	}
	.chat-compose :global(.composer textarea) {
		font-size: var(--hx-type-size-base);
	}
</style>
