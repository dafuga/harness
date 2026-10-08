<script lang="ts">
	import type { AnalyticsSnapshot } from '../services/HarnessAnalyticsService';
	let { filters }: { filters: AnalyticsSnapshot['filters'] } = $props();
	const day = (value?: string) => value?.slice(0, 10) ?? '';
</script>

<section class="analytics-section" data-harness-component="analytics-filters">
	<form class="panel analytics-form" method="get" action="/analytics">
		<div class="analytics-heading">
			<h2>History filters</h2>
			<p class="analytics-note">
				Paths and model names are free text; dates are UTC days. Live CPU is unaffected.
			</p>
		</div>
		<label class="analytics-field">
			<span class="analytics-label">Project</span>
			<input name="project" value={filters.project ?? ''} placeholder="Any project" />
		</label>
		<label class="analytics-field">
			<span class="analytics-label">Loop</span>
			<input name="loop" value={filters.loop ?? ''} placeholder="Any loop" />
		</label>
		<label class="analytics-field">
			<span class="analytics-label">Task</span>
			<input name="task" value={filters.task ?? ''} placeholder="Any task" />
		</label>
		<label class="analytics-field">
			<span class="analytics-label">Model</span>
			<input name="model" value={filters.model ?? ''} placeholder="Any model" />
		</label>
		<label class="analytics-field">
			<span class="analytics-label">Since</span>
			<input type="date" name="since" value={day(filters.since)} />
		</label>
		<label class="analytics-field">
			<span class="analytics-label">Until</span>
			<input type="date" name="until" value={day(filters.until)} />
		</label>
		<div class="analytics-actions">
			<button class="button primary" type="submit">Apply filters</button>
			<a class="text-link" href="/analytics" data-sveltekit-reload>Reset filters</a>
		</div>
	</form>
</section>
