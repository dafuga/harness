<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import '../../lib/styles/agents-providers/chatAgents.css';
	import { onMount, untrack } from 'svelte';
	import ActivityList from '../../../../reports/src/components/projects-sessions/ActivityList.svelte';
	import type { AgentEntry } from '../../../../../src/core/activityTypes';
	import { createAgentRosterStore } from '../../lib/stores/agents-providers/agentRoster.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import ReferenceText from '../explorer-ui/reference-text/ReferenceText.svelte';
	import { unitLinks } from '../explorer-ui/reference-text/unitLinks';
	/**
	 * The sessions agents registered for the project and the modules they said they work on, read
	 * live and drawn as a compact tree. It only reads: nothing here starts, stops or changes an agent.
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
	/** The UTC clock time of the reading shown; after a failed refresh it may be out of date. */
	const clock = $derived(sample?.sampledAt.slice(11, 16));
	/**
	 * A dot only repeats the status word beside it: amber while working, red where the word says it
	 * failed or is blocked, green only where it says done. Any other word stays gray.
	 */
	function tone(label: string) {
		if (label === 'Working') return 'active';
		if (/\b(fail(ed|ing)?|error|blocked)\b/i.test(label)) return 'blocked';
		if (/^(done|completed?|accepted)$/i.test(label)) return 'done';
		return 'idle';
	}
</script>

{#snippet sessionRow(item: { agent: AgentEntry; label: string })}
	{@const { agent, label } = item}
	{@const runs = [agent.model || agent.provider, agent.branch].filter(Boolean).join(' · ')}
	<hx-div class="agents-row {tone(label)}">
		<hx-span class="agents-dot" aria-hidden="true"></hx-span>
		<hx-strong class="agents-name">{agent.label}</hx-strong>
		<hx-span class="agents-state">{label}</hx-span>
	</hx-div>
	{#if agent.task}<hx-p class="agents-task">{agent.task}</hx-p>{/if}
	{#if runs}<hx-p class="agents-quiet agents-meta">{runs}</hx-p>{/if}
{/snippet}

<hx-section
	class="agents"
	data-harness-component="agents-providers-chat-agents"
	aria-busy={activity.loading}
>
	<hx-div class="agents-head">
		{#if sample}<hx-p class="agents-read">
				<hx-span><hx-strong>{working ?? 'Unknown'}</hx-strong> working</hx-span>
				<hx-time datetime={sample.sampledAt} title={sample.sampledAt}>read {clock} UTC</hx-time>
			</hx-p>{:else}<hx-p class="agents-quiet" role="status">
				{activity.loading
					? 'Reading agent activity…'
					: 'Live agent activity is unavailable for this project.'}
			</hx-p>{/if}
		<hx-button
			type="button"
			aria-label="Refresh agents"
			disabled={activity.loading}
			onclick={() => activity.refresh()}>Refresh</hx-button
		>
	</hx-div>
	{#if pinned}<hx-p class="agents-quiet">Live activity · independent of this revision</hx-p>{/if}
	{#if sample}
		{#if activity.error}<hx-p class="error" role="status">{activity.error}</hx-p>
			<hx-p class="agents-quiet">The {clock} UTC reading below may be out of date.</hx-p>{/if}
		{#if sample.agents.unreadable}<hx-p class="agents-quiet" role="status">
				{sample.agents.unreadable} unreadable registrations are not counted.
			</hx-p>{/if}
		<!-- Work first, as in the plan tree: each module, then the agents that said they work on it. -->
		<hx-section aria-label="Modules being worked on">
			<hx-h3>Modules being worked on</hx-h3>
			{#if modules.length}<hx-ul class="agents-tree">
					{#each modules as module (module.id)}<hx-li>
							<hx-div class="agents-row active">
								<hx-span class="agents-dot" aria-hidden="true"></hx-span>
								<hx-span class="agents-name agents-unit"
									>{#if module.known}<ReferenceText
											text={`[[unit:${module.id}]]`}
											{workspace}
										/>{:else}<hx-code>{module.id}</hx-code>
										<hx-span class="agents-quiet">Not in this revision</hx-span>{/if}</hx-span
								>
								<hx-span class="agents-state">Assigned</hx-span>
							</hx-div>
							{#if module.owners.length}<hx-ul
									class="agents-tree agents-branch"
									aria-label={`Agents on ${module.id}`}
								>
									{#each module.owners as owner (owner.id)}<hx-li>{owner.label}</hx-li>{/each}
								</hx-ul>{/if}
						</hx-li>{/each}
				</hx-ul>{:else}<hx-p class="agents-quiet">No fresh assignments</hx-p>{/if}
		</hx-section>
		<hx-section aria-label="Main chats">
			<hx-h3>Main chats</hx-h3>
			{#if activity.sessions.length}<ActivityList
					items={activity.sessions}
					label="Agent sessions"
					noun="sessions"
					preview={3}
					row={sessionRow}
				/>{:else}<hx-p class="agents-quiet">
					{unused ? 'No agent has registered here yet' : 'No sessions are registered'}
				</hx-p>{/if}
		</hx-section>
		<hx-p class="agents-quiet">
			Sessions and modules as agents registered them with Harness; transcripts are not read.
		</hx-p>
	{/if}
</hx-section>
