<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Models, Usage, Check } from './AnalyticsModels.types';

	import type { AnalyticsSnapshot } from '../../services/explorer-ui/HarnessAnalyticsService';
	import { analyticsCount, analyticsDisplay } from '../../utils/reports-media/analyticsDisplay';
	let { models }: { models: Models } = $props();
	// Names are listed exactly as recorded, so an explicit "unknown" stays "unknown".
	function usage(source: Record<string, number>): Usage[] {
		return Object.entries(source).map(([name, count]) => ({ name, count }));
	}
	let authors = $derived(usage(models.authors));
	let loopAuthors = $derived(usage(models.loopAuthors));
	let evaluators = $derived(usage(models.evaluators));
	let firstTry = $derived(Object.entries(models.firstTryByAuthor));
	const share = (row: Usage, rows: Usage[]) =>
		Math.round(((row.count ?? 0) / Math.max(1, ...rows.map((item) => item.count ?? 0))) * 100);
	// Nothing assessed means no rate, whatever number the snapshot carries.
	const rate = (check: Check) =>
		analyticsDisplay(check.firstTry.denominator ? check.firstTry.rate : null);
</script>

{#snippet usageCard(title: string, hint: string, rows: Usage[], empty: string)}
	<hx-div class="analytics-card">
		<hx-div class="analytics-heading">
			<hx-h3>{title}</hx-h3>
			<hx-p class="analytics-meta">{analyticsCount(rows.length)} distinct</hx-p>
		</hx-div>
		<hx-p class="analytics-note">{hint}</hx-p>
		{#if rows.length}
			<hx-div class="analytics-scroll">
				<hx-ul class="analytics-bars">
					{#each rows as row (row.name)}
						<hx-li>
							<hx-span>{row.name}</hx-span>
							{#if row.count !== null}
								<hx-span class="analytics-num">{analyticsCount(row.count)}</hx-span>
								<hx-div class="analytics-bar" aria-hidden="true">
									<hx-span style:width={share(row, rows) + '%'}></hx-span>
								</hx-div>
							{/if}
						</hx-li>
					{/each}
				</hx-ul>
			</hx-div>
		{:else}
			<hx-p class="analytics-empty">{empty}</hx-p>
		{/if}
	</hx-div>
{/snippet}

{#snippet rateCell(check: Check)}
	<hx-td>
		{rate(check)}
		{#if check.firstTry.denominator}
			<hx-small>
				{analyticsCount(check.firstTry.numerator)} of {analyticsCount(check.firstTry.denominator)}
				assessed passed first try
			</hx-small>
		{/if}
		<hx-small>
			Checks: {analyticsCount(check.checks)} · Excluded: {analyticsCount(check.excluded)}
		</hx-small>
	</hx-td>
{/snippet}

<hx-section class="analytics-section" data-harness-component="analytics-models">
	<hx-div class="analytics-heading">
		<hx-h2>Models</hx-h2>
		<hx-p class="analytics-meta">Who wrote the work and who judged it</hx-p>
	</hx-div>
	<hx-p class="analytics-note">
		<hx-strong>Author</hx-strong> models write the response or code that a check looks at.
		<hx-strong>Evaluator</hx-strong> models judge that work and are never credited as its author, so first-try
		rates are grouped by author model. A count is how often a model was recorded in that role, and a model
		recorded as “unknown” stays unknown rather than being guessed or merged.
	</hx-p>
	<hx-div class="analytics-grid analytics-pair">
		{@render usageCard(
			'Check authors',
			'Author models that wrote the work the checks looked at.',
			authors,
			'No author models recorded for checks in this view yet.'
		)}
		{@render usageCard(
			'Loop authors',
			'Author models recorded for the harness loops.',
			loopAuthors,
			'No loop authors recorded in this view yet.'
		)}
		{@render usageCard(
			'Evaluator models',
			'Models that judged the work rather than writing it.',
			evaluators,
			'No evaluator models recorded in this view yet.'
		)}
		<hx-div class="analytics-card">
			<hx-div class="analytics-heading">
				<hx-h3>Jev evaluator tokens</hx-h3>
				<hx-p class="analytics-meta">
					{analyticsCount(models.inputTokens + models.outputTokens)} combined
				</hx-p>
			</hx-div>
			<hx-p class="analytics-note"
				>Input and output tokens recorded by Jev for assessments in this view.</hx-p
			>
			<hx-div class="analytics-grid analytics-tiles">
				<hx-div>
					<hx-p class="analytics-label">Input tokens</hx-p>
					<hx-span class="analytics-value">{analyticsCount(models.inputTokens)}</hx-span>
				</hx-div>
				<hx-div>
					<hx-p class="analytics-label">Output tokens</hx-p>
					<hx-span class="analytics-value">{analyticsCount(models.outputTokens)}</hx-span>
				</hx-div>
			</hx-div>
		</hx-div>
	</hx-div>
	<hx-div class="analytics-card">
		<hx-div class="analytics-heading">
			<hx-h3>First-try rate by author model</hx-h3>
			<hx-p class="analytics-meta">{analyticsCount(firstTry.length)} listed</hx-p>
		</hx-div>
		<hx-p class="analytics-note">
			Share of assessed tasks whose first check passed. Excluded checks are left out of the rate
			instead of counting as failures, and a model with nothing assessed shows “{analyticsDisplay(
				null
			)}” rather than 0%.
		</hx-p>
		{#if firstTry.length}
			<hx-div class="analytics-scroll">
				<hx-table class="analytics-table">
					<hx-thead>
						<hx-tr>
							<hx-th scope="col">Author model</hx-th>
							<hx-th scope="col">Response</hx-th>
							<hx-th scope="col">Clean code</hx-th>
						</hx-tr>
					</hx-thead>
					<hx-tbody>
						{#each firstTry as [name, checks] (name)}
							<hx-tr>
								<hx-td>{name}</hx-td>
								{@render rateCell(checks.response)}
								{@render rateCell(checks.cleanCode)}
							</hx-tr>
						{/each}
					</hx-tbody>
				</hx-table>
			</hx-div>
		{:else}
			<hx-p class="analytics-empty">
				No first-try results by author model yet. Rates appear once checks are assessed.
			</hx-p>
		{/if}
	</hx-div>
</hx-section>
