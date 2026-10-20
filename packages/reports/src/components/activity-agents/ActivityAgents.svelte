<script lang="ts">
	import type { AgentEntry, AgentRoster } from '../../../../../src/core/activityTypes';
	import { activityDisplay } from './activityDisplay';
	import { activityReading } from './activityReading';
	import ActivityList from '../ActivityList.svelte';
	let {
		agents,
		sampledAt = '',
		reading
	}: {
		/** Null where nothing can be asked: a recorded history has no agents. */
		agents: AgentRoster | null;
		sampledAt?: string;
		/** How an open page reads again; absent where what is shown is read once. */
		reading?: { now: number; failed: boolean; refresh: () => void };
	} = $props();
	const named = 4;
	let view = $derived(
		agents ? activityReading(agents, sampledAt, reading?.now ?? Date.parse(sampledAt)) : null
	);
	let read = $derived(sampledAt.slice(11, 19));
</script>

{#snippet chips(units: string[], unknown: string[])}
	{#each units as unit (unit)}
		<span class="pa-chip"
			>{unit}{#if unknown.includes(unit)}
				<em>not in the registry</em>{/if}</span
		>
	{/each}
{/snippet}

{#snippet stated(agent: AgentEntry)}
	{#if agent.task}<span>Task: {agent.task}</span>{/if}
	{#if agent.loop}<span>Loop: {agent.loop}</span>{/if}
{/snippet}

{#snippet agentRow(agent: AgentEntry)}
	<div class="pa-row">
		<strong>{agent.label}</strong>
		<span class={'pa-state ' + agent.state}>{view?.label(agent)}</span>
	</div>
	<div class="pa-meta">
		<span>{[agent.provider, agent.model].filter(Boolean).join(' · ') || 'Model not stated'}</span>
		<span>{agent.worktree} · branch {agent.branch ?? 'none'}</span>
		{#if agent.state === 'working'}{@render stated(agent)}{/if}
	</div>
	{#if agent.state === 'working'}
		{#if agent.units.length}
			<div class="pa-tags">
				{@render chips(agent.units.slice(0, named), agent.unknownUnits)}
				{#if agent.units.length > named}
					<details class="pa-detail">
						<summary>and {agent.units.length - named} more</summary>
						<div class="pa-tags">{@render chips(agent.units.slice(named), agent.unknownUnits)}</div>
					</details>
				{/if}
			</div>
		{/if}
	{:else if agent.task || agent.loop || agent.units.length}
		<!-- What an agent that is not working had stated is kept, one control away. -->
		<details class="pa-detail">
			<summary>What it stated</summary>
			<div class="pa-meta">{@render stated(agent)}</div>
			<div class="pa-tags">{@render chips(agent.units, agent.unknownUnits)}</div>
		</details>
	{/if}
	<small>{agent.outcome ? agent.outcome + ' · ' : ''}{agent.detail}</small>
{/snippet}

<section class="pa-card" aria-label="Working agents">
	<div class="pa-head">
		<h2>Working agents</h2>
		{#if agents}
			<span class="pa-note"
				>Live · read {read} UTC
				{#if reading}
					<button
						type="button"
						class="pa-more"
						aria-label="Refresh activity"
						onclick={reading.refresh}>Refresh</button
					>
				{/if}</span
			>
		{/if}
	</div>
	{#if !agents || !view}
		<p class="pa-empty">
			Live agent activity is not part of a recorded history. A running Harness shows it for its own
			checkout.
		</p>
	{:else}
		{#if reading?.failed}
			<p class="pa-warn" role="status">
				Activity could not be read again since {read} UTC{view.current
					? '.'
					: '; who is working now is not known.'}
			</p>
		{/if}
		<p class="pa-count">
			<strong data-testid="agents-working">{view.working ?? 'Unknown'}</strong>
			<span
				>{view.current || agents.working === null
					? activityDisplay({ ...agents, working: view.working })
					: 'The last reading is older than a minute, so who is working now is not known.'}</span
			>
		</p>
		{#if agents.tracking === 'never-used'}
			<p class="pa-note">
				An agent says that it is working with <code>harness activity register</code>, keeps saying
				so with <code>harness activity heartbeat</code> and ends with
				<code>harness activity finish</code>.
			</p>
		{/if}
		{#if agents.unreadable}
			<p class="pa-note">
				{agents.unreadable} registrations could not be read and are not counted.
			</p>
		{/if}
		{#if agents.roster.length}
			<ActivityList
				items={agents.roster}
				label="Agent roster"
				noun="agents"
				preview={5}
				row={agentRow}
			/>
		{/if}
	{/if}
</section>
