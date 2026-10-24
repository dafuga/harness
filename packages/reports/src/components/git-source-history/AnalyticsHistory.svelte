<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Props } from './AnalyticsHistory.types';

	import type { AnalyticsSnapshot } from '../../services/explorer-ui/HarnessAnalyticsService';
	import { analyticsCount, analyticsDisplay } from '../../utils/reports-media/analyticsDisplay';
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

<hx-section class="analytics-section" data-harness-component="analytics-history">
	<hx-div class="analytics-heading">
		<hx-h2>Loop history</hx-h2>
		<hx-p class="analytics-note">{analyticsCount(loops.length)} shown · times in UTC</hx-p>
	</hx-div>
	<hx-div class="panel">
		{#if loops.length}
			<hx-div class="analytics-scroll">
				<hx-table class="analytics-table">
					<hx-thead>
						<hx-tr>
							<hx-th>Loop</hx-th>
							<hx-th>Template</hx-th>
							<hx-th>Agent model</hx-th>
							<hx-th>Status</hx-th>
							<hx-th>Created</hx-th>
							<hx-th>Completed</hx-th>
							<hx-th class="analytics-num">Duration</hx-th>
							<hx-th class="analytics-num">Evaluations</hx-th>
						</hx-tr>
					</hx-thead>
					<hx-tbody>
						{#each loops as loop}
							{@const done = loop.status === 'complete'}
							<hx-tr>
								<hx-td class="analytics-wrap">
									<hx-strong>{loop.name}</hx-strong>
								</hx-td>
								<hx-td>{loop.template ?? '—'}</hx-td>
								<hx-td>{loop.agentModel}</hx-td>
								<hx-td><hx-span class="badge" class:passed={done}>{loop.status}</hx-span></hx-td>
								<hx-td>{stamp(loop.createdAt)}</hx-td>
								<hx-td>{stamp(loop.completedAt)}</hx-td>
								<hx-td class="analytics-num">{duration(loop.durationMs)}</hx-td>
								<hx-td class="analytics-num">{loop.evaluations}</hx-td>
							</hx-tr>
						{/each}
					</hx-tbody>
				</hx-table>
			</hx-div>
		{:else}
			<hx-p class="analytics-empty">No loops recorded in this view.</hx-p>
		{/if}
	</hx-div>
	<hx-div class="analytics-grid analytics-pair">
		{#each lists as list (list.title)}
			<hx-div class="panel analytics-grid">
				<hx-div class="analytics-heading">
					<hx-h3>{list.title}</hx-h3>
					<hx-span class="analytics-note">Count · share</hx-span>
				</hx-div>
				{#if list.rows.length}
					<hx-ul class="analytics-bars analytics-scroll">
						{#each list.rows as row (row.name)}
							<hx-li>
								<hx-span>{row.name}</hx-span>
								<hx-span class="analytics-num">
									{analyticsCount(row.count)} · {analyticsDisplay(row.share)}
								</hx-span>
								<hx-span class="analytics-bar" aria-hidden="true">
									<hx-span style:width="{row.width}%"></hx-span>
								</hx-span>
							</hx-li>
						{/each}
					</hx-ul>
				{:else}
					<hx-p class="analytics-empty">No {list.title.toLowerCase()} recorded.</hx-p>
				{/if}
			</hx-div>
		{/each}
	</hx-div>
</hx-section>
