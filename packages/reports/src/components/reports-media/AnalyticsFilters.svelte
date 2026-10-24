<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { AnalyticsSnapshot } from '../../services/explorer-ui/HarnessAnalyticsService';
	let { filters }: { filters: AnalyticsSnapshot['filters'] } = $props();
	const day = (value?: string) => value?.slice(0, 10) ?? '';
</script>

<hx-section class="analytics-section" data-harness-component="analytics-filters">
	<hx-form class="panel analytics-form" method="get" action="/harness/analytics">
		<hx-div class="analytics-heading">
			<hx-h2>History filters</hx-h2>
			<hx-p class="analytics-note">
				Loop, task and model names are free text; dates are UTC days. Live CPU is unaffected.
			</hx-p>
		</hx-div>
		<hx-label class="analytics-field">
			<hx-span class="analytics-label">Loop</hx-span>
			<hx-input name="loop" defaultValue={filters.loop ?? ''} placeholder="Any loop" />
		</hx-label>
		<hx-label class="analytics-field">
			<hx-span class="analytics-label">Task</hx-span>
			<hx-input name="task" defaultValue={filters.task ?? ''} placeholder="Any task" />
		</hx-label>
		<hx-label class="analytics-field">
			<hx-span class="analytics-label">Model</hx-span>
			<hx-input name="model" defaultValue={filters.model ?? ''} placeholder="Any model" />
		</hx-label>
		<hx-label class="analytics-field">
			<hx-span class="analytics-label">Since</hx-span>
			<hx-input type="date" name="since" defaultValue={day(filters.since)} />
		</hx-label>
		<hx-label class="analytics-field">
			<hx-span class="analytics-label">Until</hx-span>
			<hx-input type="date" name="until" defaultValue={day(filters.until)} />
		</hx-label>
		<hx-div class="analytics-actions">
			<hx-button class="button primary" type="submit">Apply filters</hx-button>
			<hx-a class="text-link" href="/harness/analytics" data-sveltekit-reload>Reset filters</hx-a>
		</hx-div>
	</hx-form>
</hx-section>
