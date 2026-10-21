<script lang="ts">
	import FloatingChat from '../../../reports/src/components/FloatingChat.svelte';
	import { onMount, untrack } from 'svelte';
	import { createProjectAgentStore } from '../lib/stores/projectAgent.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import { visualCategory } from '../utils/composeModes';
	import Composer from './Composer.svelte';
	import ReferenceText from './reference-text/ReferenceText.svelte';
	let { workspace, open = $bindable(false) }: { workspace: Workspace; open?: boolean } = $props();
	// Rebuilt only for another project; the workspace itself is one object throughout.
	// svelte-ignore state_referenced_locally
	const agent = createProjectAgentStore(workspace);
	const kind = $derived(workspace.category.slice(0, -1));
	const label = $derived(agent.allowed ? 'Work with agent' : 'Open project chat');
	onMount(() => agent.listen());
	$effect(() => {
		if (open && agent.allowed) untrack(() => agent.loadProviders());
	});
	/** Where a draft that was left without the request is; it is linked and never opened. */
	const draft = $derived(
		agent.saved ? workspace.path(agent.saved.category, agent.saved.entityId) : ''
	);
	const quiet = $derived(!agent.messages.length && !agent.asked);
	/** What is under way is shown once: not again where the transcript already ends with it. */
	function pending(author: 'user' | 'agent', text: string) {
		if (!agent.active) return false;
		const end = agent.messages.slice(-2);
		return Boolean(text) && !end.some((item) => item.author === author && item.text === text);
	}
</script>

{#snippet line(author: 'user' | 'agent', text: string)}<li class="chat-message {author}">
		<span class="chat-author">{author === 'user' ? 'You: ' : 'Agent: '}</span><ReferenceText
			{text}
			{workspace}
			history
		/>
	</li>{/snippet}

<!-- One conversation for the project: it stays open through entities, history and pinned commits,
     what it offers is what the store allows here, and a unit it names opens at its history. -->
<div class="project-chat">
	<FloatingChat
		bind:open
		{label}
		panelLabel="Project agent"
		title="Project chat"
		notice={agent.notice}
	>
		<div class="chat-thread">
			{#if quiet}<p class="chat-note">No messages yet.</p>{:else}<ol class="chat-log">
					{#each agent.messages as message (message.id)}
						{@render line(message.author, message.text)}
					{/each}
					{#if pending('user', agent.asked)}{@render line('user', agent.asked)}{/if}
					{#if pending('agent', agent.said)}{@render line('agent', agent.said)}{/if}
				</ol>{/if}
			{#if agent.status && (agent.active || !agent.messages.at(-1)?.text.includes(agent.status))}<p
					class="chat-note chat-status"
					role="status"
				>
					<span><ReferenceText text={agent.status} {workspace} history /></span>
					{#if agent.runId}<button type="button" onclick={() => agent.cancel()}>Cancel</button>{/if}
				</p>{/if}
			{#if agent.error}<p class="error" role="alert">{agent.error}</p>{/if}
			{#if draft}<p class="chat-note chat-status">
					<span>A draft was saved without your request. Your text is kept here.</span><button
						type="button"
						onclick={() => workspace.navigate(draft)}>Open the saved draft</button
					>
				</p>{/if}
		</div>
		<div class="chat-compose">
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
		</div>
	</FloatingChat>
</div>

<style>
	/* The panel ends under the bar at the top however far that bar wraps; a phone gives it room. */
	.project-chat {
		--floating-chat-top: 124px;
		display: contents;
	}
	@media (max-width: 1409px) {
		.project-chat {
			--floating-chat-top: 170px;
		}
	}
	@media (max-width: 1250px) {
		.project-chat {
			--floating-chat-top: 220px;
		}
	}
	@media (max-width: 560px) {
		.project-chat {
			--floating-chat-top: 96px;
		}
	}
	.chat-thread {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	/* Without a request to write, the conversation ends a margin above the panel's edge. */
	.chat-thread:last-child {
		padding-bottom: 14px;
	}
	.chat-log {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chat-message {
		max-width: 88%;
		padding: 8px 12px;
		border: 1px solid var(--line);
		border-radius: 14px;
		font-size: 14px;
		line-height: 1.45;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
	.chat-message.user {
		justify-self: end;
		border-end-end-radius: 4px;
		background: rgb(255 255 255 / 0.04);
	}
	.chat-message.agent {
		justify-self: start;
		border-color: color-mix(in srgb, var(--gold) 45%, transparent);
		border-end-start-radius: 4px;
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
		font-size: 13px;
	}
	.chat-note {
		color: var(--muted);
	}
	.chat-status {
		display: flex;
		gap: 10px;
		justify-content: space-between;
		align-items: center;
	}
	.chat-status button {
		flex: none;
		padding: 5px 10px;
	}
	.error {
		padding: 8px 12px;
		border-radius: 8px;
	}
	/* The request stays in reach under the conversation as it scrolls. */
	.chat-compose {
		position: sticky;
		bottom: 0;
		margin-top: auto;
		padding: 2px 0 14px;
		background: var(--panel);
	}
	/* The request is what is read here: it is set as large as the words around it. */
	.chat-compose :global(.composer textarea) {
		font-size: 16px;
	}
</style>
