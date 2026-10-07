<script lang="ts">
	import type { AnalyticsSnapshot } from '../services/HarnessAnalyticsService';
	import { analyticsCount, analyticsDisplay } from '../utils/analyticsDisplay';
	type Props = { summary: AnalyticsSnapshot['summary']; loops: AnalyticsSnapshot['loops'] };
	let { summary, loops }: Props = $props();
	const stamp = (value?: string) => (value ? value.slice(0, 16).replace('T', ' ') : '—');
	function duration(ms?: number) {
		if (typeof ms !== 'number') return '—';
		if (ms < 1000) return Math.round(ms) + ' ms';
		const seconds = Math.round(ms / 1000);
		if (seconds < 60) return seconds + ' s';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return minutes + ' min ' + (seconds % 60) + ' s';
		return Math.floor(minutes / 60) + ' h ' + (minutes % 60) + ' min';
	}
	// Bars scale to the largest count; the percentage is each entry's share of the total.
	function frequencies(counts: Record<string, number>, newestFirst = false) {
		const entries = Object.entries(counts);
		const total = entries.reduce((sum, [, count]) => sum + count, 0);
		const peak = Math.max(1, ...entries.map(([, count]) => count));
		return entries
			.sort((a, b) => (newestFirst ? b[0].localeCompare(a[0]) : b[1] - a[1]))
			.map(([name, count]) => ({
				name,
				count,
				share: total ? count / total : 0,
				width: (count / peak) * 100
			}));
	}
	let lists = $derived([
		{ title: 'Templates', rows: frequencies(summary.templates) },
		{ title: 'Commands', rows: frequencies(summary.commands) },
		{ title: 'Evaluator outcomes', rows: frequencies(summary.evaluatorOutcomes) },
		{ title: 'Daily activity', rows: frequencies(summary.daily, true) }
	]);
</script>

<section class="analytics-section" data-harness-component="analytics-history">
	<div class="analytics-heading">
		<h2>Loop history</h2>
		<p class="analytics-note">{analyticsCount(loops.length)} shown · times in UTC</p>
	</div>
	<div class="panel">
		{#if loops.length}
			<div class="analytics-scroll">
				<table class="analytics-table">
					<thead>
						<tr>
							<th>Loop</th>
							<th>Template</th>
							<th>Agent model</th>
							<th>Status</th>
							<th>Created</th>
							<th>Completed</th>
							<th class="analytics-num">Duration</th>
							<th class="analytics-num">Evaluations</th>
						</tr>
					</thead>
					<tbody>
						{#each loops as loop}
							{@const done = loop.status === 'complete'}
							<tr>
								<td class="analytics-wrap">
									<strong>{loop.name}</strong>
									<small>{loop.project}</small>
								</td>
								<td>{loop.template ?? '—'}</td>
								<td>{loop.agentModel}</td>
								<td><span class="badge" class:passed={done}>{loop.status}</span></td>
								<td>{stamp(loop.createdAt)}</td>
								<td>{stamp(loop.completedAt)}</td>
								<td class="analytics-num">{duration(loop.durationMs)}</td>
								<td class="analytics-num">{loop.evaluations}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="analytics-empty">No loops recorded in this view.</p>
		{/if}
	</div>
	<div class="analytics-grid analytics-pair">
		{#each lists as list (list.title)}
			<div class="panel analytics-grid">
				<div class="analytics-heading">
					<h3>{list.title}</h3>
					<span class="analytics-note">Count · share</span>
				</div>
				{#if list.rows.length}
					<ul class="analytics-bars analytics-scroll">
						{#each list.rows as row (row.name)}
							<li>
								<span>{row.name}</span>
								<span class="analytics-num">
									{analyticsCount(row.count)} · {analyticsDisplay(row.share)}
								</span>
								<span class="analytics-bar" aria-hidden="true">
									<span style:width="{row.width}%"></span>
								</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="analytics-empty">No {list.title.toLowerCase()} recorded.</p>
				{/if}
			</div>
		{/each}
	</div>
</section>
