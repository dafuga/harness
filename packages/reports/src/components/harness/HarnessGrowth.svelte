<script lang="ts">
	import type { HarnessExplanation, HarnessIndex } from '../../models/Harness.types';
	import type { HarnessClient } from '../../utils/harnessClient';
	import { growthMetrics, harnessGrowth, signed, unitTimings } from '../../utils/harnessGrowth';
	let {
		index,
		client,
		unit,
		onunit,
		oncompare = () => {}
	}: {
		/** Opens the comparison of a commit with the one before it, where its evidence is. */
		oncompare?: (commit: string) => void;
		index: HarnessIndex;
		client: HarnessClient;
		unit: string | null;
		onunit: (id: string) => void;
	} = $props();
	let current = $derived(unit ?? index.units[0]?.id ?? '');
	let rows = $derived(harnessGrowth(index, current));
	let timings = $derived(unitTimings(index, current));
	let reasons = $state<Record<string, HarnessExplanation[]>>({});
	const profile = (id: string) => {
		const found = index.profiles.find((item) => item.id === id);
		return found ? `${found.platform} ${found.arch}, ${found.cpu}, ${found.runtime}` : id;
	};
	const subject = (commit: string) =>
		index.revisions.find((revision) => revision.commit === commit)?.subject ?? '';
	// Only the commits where something changed need their reasons, and only when they are shown.
	$effect(() => {
		const wanted = rows.filter((row) => row.changed).map((row) => row.commit);
		const unitId = current;
		for (const commit of wanted) {
			void client.revision(commit).then((detail) => {
				const found = detail.explanations.filter((reason) => reason.unit === unitId);
				reasons = { ...reasons, [`${unitId}\n${commit}`]: found };
			});
		}
	});
</script>

<section class="hc-card">
	<label class="hc-field"
		>Component
		<select
			aria-label="Component"
			value={current}
			onchange={(event) => onunit(event.currentTarget.value)}
		>
			{#each index.units as item (item.id)}<option value={item.id}>{item.id}</option>{/each}
		</select>
	</label>
	<div class="hc-table-wrap">
		<table class="hc-table" aria-label={'Growth of ' + current}>
			<thead>
				<tr
					><th>Commit</th><th>Source bytes</th><th>Complexity</th><th>Dependencies</th><th>Why</th
					></tr
				>
			</thead>
			<tbody>
				{#each rows as row, position (position)}
					<tr>
						<td>{row.commit.slice(0, 7)}<br /><span class="hc-muted">{row.subject}</span></td>
						{#each growthMetrics as metric (metric)}
							<td
								>{row.values[metric] ?? 'unavailable'}
								{#if row.deltas[metric]}
									<span class={(row.deltas[metric] ?? 0) > 0 ? 'hc-up' : 'hc-down'}
										>{signed(row.deltas[metric])}</span
									>
								{/if}
								{#if row.notes[metric]}
									<br /><span class="hc-muted">{row.notes[metric]}</span>
								{/if}</td
							>
						{/each}
						<td>
							{#each reasons[`${current}\n${row.commit}`] ?? [] as reason, position (position)}
								<div>{reason.behavior}</div>
							{/each}
							{#if row.changed}
								<button type="button" class="hc-chip" onclick={() => oncompare(row.commit)}
									>Evidence before and after</button
								>
							{/if}
							{#if row.changed && !(reasons[`${current}\n${row.commit}`] ?? []).length}
								<span class="hc-muted">No reason is recorded.</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if rows.length === 0}<p class="hc-muted">No record has measured this component.</p>{/if}
</section>
<section class="hc-card hc-panel" aria-label={'Timings of ' + current}>
	<h2>Timings</h2>
	{#if timings.length === 0}
		<p class="hc-muted">No timing was recorded for this component; it is unavailable, not zero.</p>
	{/if}
	{#each timings as benchmark, position (position)}
		<h3>
			{benchmark.metric} on {benchmark.workload}{benchmark.target ? ` (${benchmark.target})` : ''}
		</h3>
		{#if benchmark.incompatible}
			<p class="hc-notice">
				Not comparable: these series were measured on different machines or under different
				conditions. They are shown side by side and are not joined into one trend.
			</p>
		{/if}
		{#each benchmark.series as series, position (position)}
			<p class="hc-muted">Profile {series.profile}: {profile(series.profile)}. {series.method}</p>
			<div class="hc-table-wrap">
				<table class="hc-table">
					<thead><tr><th>Commit</th><th>Value ({series.unitOfMeasure})</th></tr></thead>
					<tbody>
						{#each series.points as point, position (position)}
							<tr>
								<td
									>{point.commit.slice(0, 7)}
									<span class="hc-muted">{subject(point.commit)}</span></td
								>
								<td>{point.value}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/each}
	{/each}
</section>
