<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Jev, Task } from './AnalyticsTasks.types';

	import type { AnalyticsSnapshot } from '../../services/explorer-ui/HarnessAnalyticsService';
	import { analyticsCount } from '../../utils/reports-media/analyticsDisplay';
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
	const reportHref = (report: string) => '/harness/reports/' + encodeURIComponent(report);
</script>

<hx-section class="analytics-section" data-harness-component="analytics-tasks">
	<hx-div class="analytics-heading">
		<hx-h2>Tasks</hx-h2>
		<hx-p class="analytics-meta">One row per task, per check type</hx-p>
	</hx-div>
	<hx-p class="analytics-note">
		Attempts are assessed attempts only. Cached, dry-run and incomplete runs are not assessments and
		are left out, so a task with none shows as not assessed rather than failed.
	</hx-p>
	{#each groups as group (group.kind)}
		<hx-div class="analytics-card">
			<hx-div class="analytics-heading">
				<hx-h3>{group.title}</hx-h3>
				<hx-p class="analytics-meta">{tally(group.tasks.length)}</hx-p>
			</hx-div>
			{#if group.tasks.length}
				<hx-div class="analytics-scroll">
					<hx-table class="analytics-table">
						<hx-thead>
							<hx-tr>
								<hx-th scope="col">Task</hx-th>
								<hx-th scope="col">Loop / step</hx-th>
								<hx-th scope="col">Agent model</hx-th>
								<hx-th scope="col">First pass</hx-th>
								<hx-th scope="col" class="analytics-num">Assessed attempts</hx-th>
								<hx-th scope="col" class="analytics-num">Attempts to pass</hx-th>
								<hx-th scope="col">Report</hx-th>
							</hx-tr>
						</hx-thead>
						<hx-tbody>
							{#each group.tasks as row}
								<hx-tr>
									<hx-td class="analytics-wrap">{text(row.task)}</hx-td>
									<hx-td>{loopStep(row)}</hx-td>
									<hx-td>{text(row.agentModel)}</hx-td>
									<hx-td>{firstPass(row)}</hx-td>
									<hx-td class="analytics-num">{analyticsCount(row.attempts)}</hx-td>
									<hx-td class="analytics-num">{toPass(row)}</hx-td>
									<hx-td>
										{#if row.report}
											<hx-a class="text-link" href={reportHref(row.report)}>View report</hx-a>
										{:else}
											<hx-span class="muted">No report</hx-span>
										{/if}
									</hx-td>
								</hx-tr>
							{/each}
						</hx-tbody>
					</hx-table>
				</hx-div>
			{:else}
				<hx-p class="analytics-empty">
					No {group.kind} tasks in this view yet. They appear here once the harness records them.
				</hx-p>
			{/if}
		</hx-div>
	{/each}
</hx-section>
