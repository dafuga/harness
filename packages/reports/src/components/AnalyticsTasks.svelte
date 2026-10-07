<script lang="ts">
	import type { AnalyticsSnapshot } from '../services/HarnessAnalyticsService';
	import { analyticsCount } from '../utils/analyticsDisplay';
	type Jev = AnalyticsSnapshot['jev'];
	type Task = Jev['response']['tasks'][number];
	let { jev }: { jev: Jev } = $props();
	let groups = $derived([
		{ title: 'Response checks', kind: 'response', tasks: jev.response.tasks },
		{ title: 'Clean-code checks', kind: 'clean-code', tasks: jev.cleanCode.tasks }
	]);
	const text = (value?: string | number | null) =>
		value === undefined || value === null || value === '' ? '—' : String(value);
	const tally = (count: number) => analyticsCount(count) + (count === 1 ? ' task' : ' tasks');
	function loopStep(row: Task) {
		const parts = [text(row.loop), text(row.step)];
		return parts.every((part) => part === '—') ? '—' : parts.join(' / ');
	}
	// No assessed attempts means "not assessed", never a failed first try.
	function firstPass(row: Task) {
		if (row.firstPassed) return 'Yes';
		return row.attempts ? 'No' : 'Not assessed';
	}
	const toPass = (row: Task) =>
		row.attemptsToPass === null ? 'Not yet passed' : analyticsCount(row.attemptsToPass);
	const reportHref = (report: string) => '/reports/' + encodeURIComponent(report);
</script>

<section class="analytics-section" data-harness-component="analytics-tasks">
	<div class="analytics-heading">
		<h2>Tasks</h2>
		<p class="analytics-meta">One row per task, per check type</p>
	</div>
	<p class="analytics-note">
		Attempts are assessed attempts only. Cached, dry-run and incomplete runs are not assessments and
		are left out, so a task with none shows as not assessed rather than failed.
	</p>
	{#each groups as group (group.kind)}
		<div class="analytics-card">
			<div class="analytics-heading">
				<h3>{group.title}</h3>
				<p class="analytics-meta">{tally(group.tasks.length)}</p>
			</div>
			{#if group.tasks.length}
				<div class="analytics-scroll">
					<table class="analytics-table">
						<thead>
							<tr>
								<th scope="col">Task</th>
								<th scope="col">Project</th>
								<th scope="col">Loop / step</th>
								<th scope="col">Agent model</th>
								<th scope="col">First pass</th>
								<th scope="col" class="analytics-num">Assessed attempts</th>
								<th scope="col" class="analytics-num">Attempts to pass</th>
								<th scope="col">Report</th>
							</tr>
						</thead>
						<tbody>
							{#each group.tasks as row}
								<tr>
									<td class="analytics-wrap">{text(row.task)}</td>
									<td>{text(row.project)}</td>
									<td>{loopStep(row)}</td>
									<td>{text(row.agentModel)}</td>
									<td>{firstPass(row)}</td>
									<td class="analytics-num">{analyticsCount(row.attempts)}</td>
									<td class="analytics-num">{toPass(row)}</td>
									<td>
										{#if row.report}
											<a class="text-link" href={reportHref(row.report)}>View report</a>
										{:else}
											<span class="muted">No report</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="analytics-empty">
					No {group.kind} tasks in this view yet. They appear here once the harness records them.
				</p>
			{/if}
		</div>
	{/each}
</section>
