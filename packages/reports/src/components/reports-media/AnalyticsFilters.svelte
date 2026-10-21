<script lang="ts">
	import type { AnalyticsSnapshot } from '../../services/explorer-ui/HarnessAnalyticsService';
	let { filters }: { filters: AnalyticsSnapshot['filters'] } = $props();
	const day = (value?: string) => value?.slice(0, 10) ?? '';
</script>

<section class="analytics-section" data-harness-component="analytics-filters">
	<form class="panel analytics-form" method="get" action="/harness/analytics">
		<div class="analytics-heading">
			<h2>History filters</h2>
			<p class="analytics-note">
				Loop, task and model names are free text; dates are UTC days. Live CPU is unaffected.
			</p>
		</div>
		<label class="analytics-field">
			<span class="analytics-label">Loop</span>
			<input name="loop" defaultValue={filters.loop ?? ''} placeholder="Any loop" />
		</label>
		<label class="analytics-field">
			<span class="analytics-label">Task</span>
			<input name="task" defaultValue={filters.task ?? ''} placeholder="Any task" />
		</label>
		<label class="analytics-field">
			<span class="analytics-label">Model</span>
			<input name="model" defaultValue={filters.model ?? ''} placeholder="Any model" />
		</label>
		<label class="analytics-field">
			<span class="analytics-label">Since</span>
			<input type="date" name="since" defaultValue={day(filters.since)} />
		</label>
		<label class="analytics-field">
			<span class="analytics-label">Until</span>
			<input type="date" name="until" defaultValue={day(filters.until)} />
		</label>
		<div class="analytics-actions">
			<button class="button primary" type="submit">Apply filters</button>
			<a class="text-link" href="/harness/analytics" data-sveltekit-reload>Reset filters</a>
		</div>
	</form>
</section>
