<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { AgentEntry, AgentRoster } from '../../../../../../src/core/activityTypes';
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
		<hx-span class="pa-chip"
			>{unit}{#if unknown.includes(unit)}
				<hx-em>not in the registry</hx-em>{/if}</hx-span
		>
	{/each}
{/snippet}

{#snippet stated(agent: AgentEntry)}
	{#if agent.task}<hx-span>Task: {agent.task}</hx-span>{/if}
	{#if agent.loop}<hx-span>Loop: {agent.loop}</hx-span>{/if}
{/snippet}

{#snippet agentRow(agent: AgentEntry)}
	<hx-div class="pa-row">
		<hx-strong>{agent.label}</hx-strong>
		<hx-span class={'pa-state ' + agent.state}>{view?.label(agent)}</hx-span>
	</hx-div>
	<hx-div class="pa-meta">
		<hx-span
			>{[agent.provider, agent.model].filter(Boolean).join(' · ') || 'Model not stated'}</hx-span
		>
		<hx-span>{agent.worktree} · branch {agent.branch ?? 'none'}</hx-span>
		{#if agent.state === 'working'}{@render stated(agent)}{/if}
	</hx-div>
	{#if agent.state === 'working'}
		{#if agent.units.length}
			<hx-div class="pa-tags">
				{@render chips(agent.units.slice(0, named), agent.unknownUnits)}
				{#if agent.units.length > named}
					<hx-details class="pa-detail">
						<hx-summary>and {agent.units.length - named} more</hx-summary>
						<hx-div class="pa-tags"
							>{@render chips(agent.units.slice(named), agent.unknownUnits)}</hx-div
						>
					</hx-details>
				{/if}
			</hx-div>
		{/if}
	{:else if agent.task || agent.loop || agent.units.length}
		<!-- What an agent that is not working had stated is kept, one control away. -->
		<hx-details class="pa-detail">
			<hx-summary>What it stated</hx-summary>
			<hx-div class="pa-meta">{@render stated(agent)}</hx-div>
			<hx-div class="pa-tags">{@render chips(agent.units, agent.unknownUnits)}</hx-div>
		</hx-details>
	{/if}
	<hx-small>{agent.outcome ? agent.outcome + ' · ' : ''}{agent.detail}</hx-small>
{/snippet}

<hx-section class="pa-card" aria-label="Working agents">
	<hx-div class="pa-head">
		<hx-h2>Working agents</hx-h2>
		{#if agents}
			<hx-span class="pa-note"
				>Live · read {read} UTC
				{#if reading}
					<hx-button
						type="button"
						class="pa-more"
						aria-label="Refresh activity"
						onclick={reading.refresh}>Refresh</hx-button
					>
				{/if}</hx-span
			>
		{/if}
	</hx-div>
	{#if !agents || !view}
		<hx-p class="pa-empty">
			Live agent activity is not part of a recorded history. A running Harness shows it for its own
			checkout.
		</hx-p>
	{:else}
		{#if reading?.failed}
			<hx-p class="pa-warn" role="status">
				Activity could not be read again since {read} UTC{view.current
					? '.'
					: '; who is working now is not known.'}
			</hx-p>
		{/if}
		<hx-p class="pa-count">
			<hx-strong data-testid="agents-working">{view.working ?? 'Unknown'}</hx-strong>
			<hx-span
				>{view.current || agents.working === null
					? activityDisplay({ ...agents, working: view.working })
					: 'The last reading is older than a minute, so who is working now is not known.'}</hx-span
			>
		</hx-p>
		{#if agents.tracking === 'never-used'}
			<hx-p class="pa-note">
				An agent says that it is working with <hx-code>harness activity register</hx-code>, keeps
				saying so with <hx-code>harness activity heartbeat</hx-code> and ends with
				<hx-code>harness activity finish</hx-code>.
			</hx-p>
		{/if}
		{#if agents.unreadable}
			<hx-p class="pa-note">
				{agents.unreadable} registrations could not be read and are not counted.
			</hx-p>
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
</hx-section>
