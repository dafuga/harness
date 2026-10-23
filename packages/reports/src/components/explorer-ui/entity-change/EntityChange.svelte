<script lang="ts">
	import type {
		ExplorerHistoryDetail,
		ExplorerHistoryRow
	} from '../../../models/explorer-ui/Explorer.types';
	import { humanize } from '../../../utils/explorer-ui/entityContract';
	import { reviewChanges } from './entityHistory';
	import {
		signedBytes,
		signedCount,
		type HistoryTiming
	} from '../../../utils/explorer-ui/entityHistory';
	import { entityLens, shortCommit, type EntityNav } from '../../../utils/explorer-ui/entityLens';
	import { byteSize, notMeasured } from '../../../utils/explorer-ui/entityMeasure';
	import { writingLimits } from '../../../../../../src/utils/writing-limits/writingLimits';
	import { boundedText, entityReasons } from '../../../utils/explorer-ui/entityReasons';
	import EntityReasons from '../entity-reasons/EntityReasons.svelte';
	import HarnessAction from '../HarnessAction.svelte';
	let {
		row,
		timings,
		detail,
		nav,
		full = $bindable(false)
	}: {
		row: ExplorerHistoryRow;
		/** The timings of this commit, each profile on a line of its own. */
		timings: HistoryTiming[];
		/** What the revision of the commit says about this entity; null until it has been read. */
		detail: ExplorerHistoryDetail | null;
		nav: EntityNav;
		/** Whether the reasons are open as they were written, beside their summary. */
		full?: boolean;
	} = $props();
	// Every function's reasons together, held to the length of one; the originals stay beside it.
	let reasons = $derived(entityReasons(detail?.explanations ?? []));
	// What a reviewer wrote for a budget is not held to a limit; what is shown at once is.
	const noted = (reason: string) => boundedText([reason], writingLimits.body);
	interface Line {
		metric: string;
		before: string;
		after: string;
		delta: string;
	}
	const earlier = (now: number | null, change: number | null) =>
		now === null || change === null ? null : now - change;
	const bytes = (value: number | null) => (value === null ? notMeasured : byteSize(value));
	const count = (value: number | null) => (value === null ? notMeasured : String(value));
	const timed = (value: number | undefined, unit: string) =>
		value === undefined ? notMeasured : `${value} ${unit}`;
	let size = $derived(row.measured?.size ?? null);
	let complexity = $derived(row.measured?.complexity ?? null);
	let lines = $derived<Line[]>([
		{
			metric: 'Source size',
			before: bytes(earlier(size, row.sizeChange)),
			after: bytes(size),
			delta: signedBytes(row.sizeChange) || '—'
		},
		{
			metric: 'Complexity',
			before: count(earlier(complexity, row.complexityChange)),
			after: count(complexity),
			delta: signedCount(row.complexityChange) || '—'
		},
		...timings.map((timing) => ({
			metric: `${humanize(timing.metric)} · ${timing.profile}${timing.target ? ` · ${timing.target}` : ''}`,
			before: timed(timing.before, timing.unit),
			after: timed(timing.after, timing.unit),
			delta:
				timing.before === undefined
					? '—'
					: `${signedCount(Number((timing.after - timing.before).toFixed(4)))} ${timing.unit}`
		}))
	]);
	// A row opens the entity at its own commit, where it is compared with its own parent.
	let at = $derived(
		entityLens(nav.route, {
			category: nav.route.category,
			entity: nav.route.entity,
			commit: row.commit
		})
	);
</script>

<section
	class="ex-card ex-selected"
	aria-labelledby="ex-change-title"
	data-harness-component="harness-entity-change"
>
	<header class="ex-evidence-head">
		<div>
			<h2 id="ex-change-title">
				Selected change · <span class="ex-mono">{shortCommit(row.commit)}</span> ·
				{row.committedAt.slice(0, 10)}
			</h2>
			<p class="ex-lead">{row.subject}</p>
		</div>
		<HarnessAction href={nav.href(at)} onclick={() => nav.go(at)} tone="plain" icon="arrow-right"
			>View captured state</HarnessAction
		>
		{#if row.previous}
			<HarnessAction href={nav.href(at)} onclick={() => nav.go(at)} icon="arrow-right"
				>Compare with previous</HarnessAction
			>
		{/if}
	</header>
	<div class="ex-change-grid">
		<div>
			<h3>Why it changed</h3>
			{#if detail === null}
				<p class="ex-soft" role="status">Reading what this commit recorded…</p>
			{:else if !detail.known}
				<p class="ex-soft">
					This revision stores no registry or no impact, so what it changed is not known.
				</p>
			{:else if detail.explanations.length === 0}
				<p class="ex-soft">This commit recorded no reason for this entity.</p>
			{/if}
			{#if reasons.notes.length}
				<dl class="ex-rows">
					<div>
						<dt>Behavior</dt>
						<dd>{reasons.behavior.text}</dd>
					</div>
					<div>
						<dt>Simplification</dt>
						<dd>{reasons.simplification.text} · {reasons.simplification.outcomes.join(', ')}</dd>
					</div>
					<div>
						<dt>Performance</dt>
						<dd>{reasons.performance.text} · {reasons.performance.outcomes.join(', ')}</dd>
					</div>
				</dl>
				<EntityReasons {reasons} bind:open={full} id="ex-reasons-full" />
			{/if}
			{#each row.reviews as review, position (position)}
				<p class="ex-approval">
					<span class="ex-pill gold"
						>{review.type === 'approval' ? 'Budget increase approved' : 'Baseline reviewed'}</span
					>
					<span>{reviewChanges(review).join(', ')}</span>
					<span class="ex-soft">{review.reviewer}: {noted(review.reason).text}</span>
				</p>
				<!-- A note longer than the limit of a body is read whole on request. -->
				{#if noted(review.reason).cut}
					<details class="ex-full">
						<summary>Full review note <span class="ex-soft">{review.reviewer}</span></summary>
						<p>{review.reason}</p>
					</details>
				{/if}
			{/each}
		</div>
		<div class="ex-scroll">
			<table class="ex-mini" aria-label="Before and after, under matching profiles">
				<thead>
					<tr>
						<th scope="col">Metric</th>
						<th scope="col">Before{row.previous ? ` (${shortCommit(row.previous)})` : ''}</th>
						<th scope="col">After ({shortCommit(row.commit)})</th>
						<th scope="col">Delta</th>
					</tr>
				</thead>
				<tbody>
					{#each lines as line, position (position)}
						<tr>
							<th scope="row">{line.metric}</th>
							<td class:unmeasured={line.before === notMeasured}>{line.before}</td>
							<td class:unmeasured={line.after === notMeasured}>{line.after}</td>
							<td>{line.delta}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>
