<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { createAgentRosterStore } from '../../lib/stores/agents-providers/agentRoster.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import ReferenceText from '../explorer-ui/reference-text/ReferenceText.svelte';
	import { unitLinks } from '../explorer-ui/reference-text/unitLinks';
	/**
	 * The sessions agents registered for the project and the modules they said they work on, read
	 * live. It only reads: nothing here starts, stops or changes an agent.
	 */
	let { workspace }: { workspace: Workspace } = $props();
	const activity = untrack(() => createAgentRosterStore(workspace));
	onMount(() => activity.listen());
	const sample = $derived(activity.sample);
	/** Where no agent has ever registered, how many work now is not known either. */
	const unused = $derived(sample?.agents.tracking === 'never-used');
	const working = $derived(unused ? null : activity.working);
	/** Activity is live whatever revision is shown; beside a pinned one, that is said. */
	const pinned = $derived(Boolean(workspace.pinned));
	/** A module links as a unit of the shown revision where that revision has it. */
	const modules = $derived.by(() => {
		const link = unitLinks(workspace, null, { history: false });
		return activity.modules.map((module) => ({ ...module, known: Boolean(link(module.id)) }));
	});
</script>

<section class="agents" data-harness-component="chat-agents" aria-busy={activity.loading}>
	<div class="agents-head">
		{#if sample}<p class="agents-read">
				<span><strong>{working ?? 'Unknown'}</strong> working</span>
				<time datetime={sample.sampledAt} title={sample.sampledAt}
					>read {sample.sampledAt.slice(11, 16)} UTC</time
				>
			</p>{:else}<p class="agents-quiet" role="status">
				{activity.loading
					? 'Reading agent activity…'
					: 'Live agent activity is unavailable for this project.'}
			</p>{/if}
		<button
			type="button"
			aria-label="Refresh agents"
			disabled={activity.loading}
			onclick={() => activity.refresh()}>Refresh</button
		>
	</div>
	{#if pinned}<p class="agents-quiet">Live activity · independent of this revision</p>{/if}
	{#if sample}
		{#if activity.error}<p class="error" role="status">{activity.error}</p>{/if}
		{#if sample.agents.unreadable}<p class="agents-quiet" role="status">
				{sample.agents.unreadable} unreadable registrations are not counted.
			</p>{/if}
		<section aria-label="Main chats">
			<h3>Main chats</h3>
			{#if activity.sessions.length}<ul>
					{#each activity.sessions as { agent, label } (agent.id)}<li>
							<div class="agents-row">
								<strong>{agent.label}</strong>
								<span class="agents-quiet" class:working={label === 'Working'}>{label}</span>
							</div>
							{#if agent.task}<p class="agents-task">{agent.task}</p>{/if}
							<p class="agents-quiet">
								{[agent.model || agent.provider, agent.branch].filter(Boolean).join(' · ')}
							</p>
						</li>{/each}
				</ul>{:else}<p class="agents-quiet">
					{unused ? 'No agent has registered here yet' : 'No sessions are registered'}
				</p>{/if}
		</section>
		<section aria-label="Modules being worked on">
			<h3>Modules being worked on</h3>
			{#if modules.length}<ul>
					{#each modules as module (module.id)}<li>
							<div class="agents-row">
								<span class="agents-unit"
									>{#if module.known}<ReferenceText
											text={`[[unit:${module.id}]]`}
											{workspace}
										/>{:else}<code>{module.id}</code>
										<span class="agents-quiet">Not in this revision</span>{/if}</span
								>
								{#if module.owners.length > 1}<span class="agents-quiet"
										>{module.owners.length} agents</span
									>{/if}
							</div>
							<p class="agents-quiet">
								{#each module.owners as owner, index (owner.id)}{index ? ', ' : ''}<span
										>{owner.label}</span
									>{/each}
							</p>
						</li>{/each}
				</ul>{:else}<p class="agents-quiet">No fresh assignments</p>{/if}
		</section>
		<p class="agents-quiet">
			Sessions and modules as agents registered them with Harness; transcripts are not read.
		</p>
	{/if}
</section>

<style>
	.agents {
		display: flex;
		flex-direction: column;
		gap: var(--hx-space-12);
		padding-bottom: var(--hx-space-14);
		font-size: var(--hx-type-size-sm);
		line-height: var(--hx-style-leading-snug);
	}
	.agents p,
	.agents h3,
	.agents ul {
		margin: 0;
	}
	.agents-head,
	.agents-row,
	.agents-read {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-3) var(--hx-space-10);
		align-items: baseline;
		justify-content: space-between;
	}
	.agents-head {
		align-items: center;
	}
	.agents-head button {
		flex: none;
		padding: var(--hx-space-5) var(--hx-space-10);
	}
	.agents-read {
		justify-content: flex-start;
	}
	strong {
		font-weight: var(--hx-style-weight-semibold);
	}
	.agents-read strong,
	.agents-quiet.working {
		color: var(--hx-color-primary);
	}
	/* Section names are quiet; the sessions and modules under them are what is read. */
	h3 {
		padding-bottom: var(--hx-space-5);
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-compact);
		font-weight: var(--hx-style-weight-semibold);
	}
	ul {
		padding: 0;
		list-style: none;
	}
	li {
		padding: var(--hx-space-8) 0;
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
	}
	.agents-row + p {
		margin-top: var(--hx-space-3);
	}
	.agents-task,
	.agents-unit,
	code {
		overflow-wrap: anywhere;
	}
	.agents-quiet,
	time {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-compact);
	}
	.error {
		padding: var(--hx-space-8) var(--hx-space-12);
		border-radius: var(--hx-radius-small);
		font-size: var(--hx-type-size-compact);
	}
</style>
