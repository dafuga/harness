<script lang="ts">
	import { onMount } from 'svelte';
	import type { CpuSnapshot } from '../../../../src/utils/cpuMetrics';
	import { analyticsCpuClient } from '../utils/analyticsCpuClient';
	let snapshot = $state<CpuSnapshot | null>(null);
	let pending = $state(true);
	let client: ReturnType<typeof analyticsCpuClient> | undefined;
	let cpu = $derived(snapshot?.status === 'available' ? snapshot : null);
	const percent = (value: number | null) =>
		value === null ? 'Not measured' : value.toFixed(1) + '%';
	function refresh() {
		if (!client) return;
		if (!cpu) pending = true;
		void client.refresh();
	}
	onMount(() => {
		// A failed sample arrives as null and replaces the last reading, so nothing stale is shown.
		client = analyticsCpuClient((sample) => {
			snapshot = sample;
			pending = false;
		});
		return client.stop;
	});
</script>

<section class="analytics-section" data-harness-component="analytics-cpu">
	<div class="analytics-heading">
		<h2>Live CPU usage</h2>
		<button type="button" onclick={refresh}>Refresh CPU</button>
	</div>
	{#if pending}
		<p class="analytics-empty" role="status">Sampling CPU…</p>
	{:else if cpu}
		<div class="analytics-grid analytics-tiles">
			<div class="analytics-card analytics-accent" data-testid="cpu-machine">
				<span class="analytics-label">Whole machine</span>
				<strong class="analytics-value" class:analytics-quiet={cpu.machinePercent === null}>
					{percent(cpu.machinePercent)}
				</strong>
				<small>All processes on this machine</small>
			</div>
			{#each cpu.groups as group}
				<div class="analytics-card" data-testid={'cpu-' + group.id}>
					<span class="analytics-label">{group.label}</span>
					<strong class="analytics-value">{percent(group.machinePercent)}</strong>
					<small>Core {percent(group.corePercent)} · Processes {group.processes}</small>
				</div>
			{/each}
			<div class="analytics-card" data-testid="cpu-tracked">
				<span class="analytics-label">Tracked combined</span>
				<strong class="analytics-value">{percent(cpu.trackedPercent)}</strong>
				<small>Codex, harness and local agents together</small>
			</div>
		</div>
		<p class="analytics-note">
			Large figures are machine %, the share across all cores. Core % counts 100% as one full core.
		</p>
		<p class="analytics-meta">
			<span>Sampled {cpu.sampledAt.slice(11, 19)} UTC</span>
			<span>{cpu.logicalCores} logical cores</span>
			<span>{(cpu.intervalMs / 1000).toFixed(1)} s sample interval</span>
			<span>Auto-refreshes every 5 s while this tab is visible</span>
		</p>
		<div class="panel analytics-grid">
			<div class="analytics-heading">
				<h3>By local agent</h3>
				<span class="analytics-note">One row per agent process tree</span>
			</div>
			{#if cpu.agents.length}
				<div class="analytics-scroll">
					<table class="analytics-table">
						<thead>
							<tr>
								<th>Agent</th>
								<th class="analytics-num">PID</th>
								<th class="analytics-num">Processes</th>
								<th class="analytics-num">Core %</th>
								<th class="analytics-num">Machine %</th>
							</tr>
						</thead>
						<tbody>
							{#each cpu.agents as agent}
								<tr>
									<td class="analytics-wrap">{agent.label}</td>
									<td class="analytics-num">{agent.pid}</td>
									<td class="analytics-num">{agent.processes}</td>
									<td class="analytics-num">{percent(agent.corePercent)}</td>
									<td class="analytics-num">{percent(agent.machinePercent)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="analytics-empty">No local agent processes detected in this sample.</p>
			{/if}
		</div>
	{:else}
		<div class="notice analytics-alert" role="alert">
			<strong>CPU usage unavailable</strong>
			<span>No sample could be read, so no figures are shown.</span>
			<button type="button" onclick={refresh}>Retry</button>
		</div>
	{/if}
	<p class="analytics-note">
		Measures local processes only and ignores the history filters. The shared Codex app-server's
		CPU cannot be split by chat, and cloud model inference CPU is not measured. Samples are not
		automatically saved or published.
	</p>
</section>
