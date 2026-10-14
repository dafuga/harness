<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { createProjectAgentStore } from '../lib/stores/projectAgent.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import Composer from './Composer.svelte';
	import ReferenceText from './ReferenceText.svelte';
	let { workspace }: { workspace: Workspace } = $props();
	// The shell rebuilds this for another project; the workspace itself is one object throughout.
	// svelte-ignore state_referenced_locally
	const agent = createProjectAgentStore(workspace);
	let open = $state(false);
	let panel = $state<HTMLElement>();
	let launcher = $state<HTMLButtonElement>();
	/** Something new is asked for from a catalog; an entity that is open has its own thread. */
	const shown = $derived(agent.allowed && !workspace.entity);
	const kind = $derived(workspace.category.slice(0, -1));
	onMount(() => agent.listen());
	async function toggle() {
		open = !open;
		await tick();
		if (open) panel?.querySelector('textarea')?.focus();
		else launcher?.focus();
	}
	/** Where a draft that was left without the request is; it is linked and never opened. */
	const draft = $derived(
		agent.saved ? workspace.path(agent.saved.category, agent.saved.entityId) : ''
	);
	function escape(event: KeyboardEvent) {
		if (open && event.key === 'Escape') void toggle();
	}
</script>

<svelte:window onkeydown={escape} />
<!-- Adding to a project is a conversation: there is no form, and the catalog in view is a hint. -->
{#if shown}
	{#if open}<aside
			id="project-agent"
			class="project-agent"
			aria-label="Project agent"
			bind:this={panel}
		>
			<header>
				<div>
					<h2>Work with agent</h2>
					<p>Describe the {kind} to add. The agent proposes a plan for you to review.</p>
				</div>
				<button type="button" class="agent-close" aria-label="Close project agent" onclick={toggle}
					>×</button
				>
			</header>
			{#if agent.asked}<p class="agent-asked">
					<ReferenceText text={agent.asked} {workspace} />
				</p>{/if}
			{#if agent.said}<p class="agent-said">
					<ReferenceText text={agent.said} {workspace} />
				</p>{/if}
			{#if agent.status}<p class="agent-status" role="status">
					<span><ReferenceText text={agent.status} {workspace} /></span>{#if agent.runId}<button
							type="button"
							onclick={agent.cancel}>Cancel</button
						>{/if}
				</p>{/if}
			{#if agent.error}<p class="error" role="alert">{agent.error}</p>{/if}
			{#if draft}<p class="agent-status">
					<span>A draft was saved without your request. Your text is kept here.</span><button
						type="button"
						onclick={() => workspace.navigate(draft)}>Open the saved draft</button
					>
				</p>{/if}
			<Composer
				modes={['plan', 'change']}
				providers={agent.providers}
				approved={false}
				running={agent.active}
				placeholder={`Describe the ${kind} to add…`}
				comment={async () => false}
				send={agent.send}
			/>
		</aside>{/if}
	<button
		type="button"
		class="agent-launcher"
		bind:this={launcher}
		aria-expanded={open}
		aria-controls="project-agent"
		onclick={toggle}><span aria-hidden="true">✦</span>Work with agent</button
	>
{/if}

<style>
	.agent-launcher,
	.project-agent {
		position: fixed;
		right: 20px;
		z-index: 40;
		border: 1px solid var(--line);
		box-shadow: 0 14px 40px rgb(0 0 0 / 0.5);
	}
	.agent-launcher {
		bottom: 60px;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		padding: 12px 20px;
		border-radius: 999px;
		background: #04141e;
		color: inherit;
		font-weight: 600;
	}
	.agent-launcher span {
		color: var(--gold);
	}
	.agent-launcher:hover,
	.agent-launcher[aria-expanded='true'] {
		border-color: var(--gold);
	}
	.agent-launcher:focus-visible,
	.agent-close:focus-visible {
		outline: 2px solid var(--gold);
		outline-offset: 2px;
	}
	.project-agent {
		bottom: 120px;
		display: grid;
		gap: 12px;
		width: min(440px, calc(100vw - 40px));
		max-height: calc(100dvh - 150px);
		overflow-y: auto;
		padding: 18px;
		border-radius: 18px;
		background: var(--panel);
	}
	header {
		display: flex;
		gap: 12px;
		justify-content: space-between;
		align-items: flex-start;
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		font-size: 16px;
	}
	header p,
	.agent-status {
		margin-top: 4px;
		color: var(--muted);
		font-size: 13px;
	}
	.agent-close {
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 18px;
		line-height: 1.4;
	}
	.agent-asked,
	.agent-said {
		padding: 10px 12px;
		border: 1px solid var(--line);
		border-radius: 12px;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
	.agent-said {
		border-color: var(--gold);
	}
	/* The request is what is read here: it is set as large as the words around it. */
	.project-agent :global(.composer textarea) {
		font-size: 16px;
	}
	.agent-status {
		display: flex;
		gap: 10px;
		justify-content: space-between;
		align-items: center;
	}
	@media (max-width: 520px) {
		.agent-launcher,
		.project-agent {
			right: 12px;
		}
		.project-agent {
			width: calc(100vw - 24px);
		}
	}
</style>
