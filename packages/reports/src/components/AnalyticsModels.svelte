<script lang="ts">
	import type { AnalyticsSnapshot } from '../services/HarnessAnalyticsService';
	import { analyticsCount, analyticsDisplay } from '../utils/analyticsDisplay';
	type Models = AnalyticsSnapshot['models'];
	type Check = Models['firstTryByAuthor'][string]['response'];
	type Usage = { name: string; count: number | null };
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
	<div class="analytics-card">
		<div class="analytics-heading">
			<h3>{title}</h3>
			<p class="analytics-meta">{analyticsCount(rows.length)} distinct</p>
		</div>
		<p class="analytics-note">{hint}</p>
		{#if rows.length}
			<div class="analytics-scroll">
				<ul class="analytics-bars">
					{#each rows as row (row.name)}
						<li>
							<span>{row.name}</span>
							{#if row.count !== null}
								<span class="analytics-num">{analyticsCount(row.count)}</span>
								<div class="analytics-bar" aria-hidden="true">
									<span style:width={share(row, rows) + '%'}></span>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<p class="analytics-empty">{empty}</p>
		{/if}
	</div>
{/snippet}

{#snippet rateCell(check: Check)}
	<td>
		{rate(check)}
		{#if check.firstTry.denominator}
			<small>
				{analyticsCount(check.firstTry.numerator)} of {analyticsCount(check.firstTry.denominator)}
				assessed passed first try
			</small>
		{/if}
		<small>
			Checks: {analyticsCount(check.checks)} · Excluded: {analyticsCount(check.excluded)}
		</small>
	</td>
{/snippet}

<section class="analytics-section" data-harness-component="analytics-models">
	<div class="analytics-heading">
		<h2>Models</h2>
		<p class="analytics-meta">Who wrote the work and who judged it</p>
	</div>
	<p class="analytics-note">
		<strong>Author</strong> models write the response or code that a check looks at.
		<strong>Evaluator</strong> models judge that work and are never credited as its author, so
		first-try rates are grouped by author model. A count is how often a model was recorded in that
		role, and a model recorded as “unknown” stays unknown rather than being guessed or merged.
	</p>
	<div class="analytics-grid analytics-pair">
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
		<div class="analytics-card">
			<div class="analytics-heading">
				<h3>Jev evaluator tokens</h3>
				<p class="analytics-meta">
					{analyticsCount(models.inputTokens + models.outputTokens)} combined
				</p>
			</div>
			<p class="analytics-note">Input and output tokens recorded by Jev for assessments in this view.</p>
			<div class="analytics-grid analytics-tiles">
				<div>
					<p class="analytics-label">Input tokens</p>
					<span class="analytics-value">{analyticsCount(models.inputTokens)}</span>
				</div>
				<div>
					<p class="analytics-label">Output tokens</p>
					<span class="analytics-value">{analyticsCount(models.outputTokens)}</span>
				</div>
			</div>
		</div>
	</div>
	<div class="analytics-card">
		<div class="analytics-heading">
			<h3>First-try rate by author model</h3>
			<p class="analytics-meta">{analyticsCount(firstTry.length)} listed</p>
		</div>
		<p class="analytics-note">
			Share of assessed tasks whose first check passed. Excluded checks are left out of the
			rate instead of counting as failures, and a model with nothing assessed shows
			“{analyticsDisplay(null)}” rather than 0%.
		</p>
		{#if firstTry.length}
			<div class="analytics-scroll">
				<table class="analytics-table">
					<thead>
						<tr>
							<th scope="col">Author model</th>
							<th scope="col">Response</th>
							<th scope="col">Clean code</th>
						</tr>
					</thead>
					<tbody>
						{#each firstTry as [name, checks] (name)}
							<tr>
								<td>{name}</td>
								{@render rateCell(checks.response)}
								{@render rateCell(checks.cleanCode)}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="analytics-empty">
				No first-try results by author model yet. Rates appear once checks are assessed.
			</p>
		{/if}
	</div>
</section>
