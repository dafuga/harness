<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Line } from './EntityChange.types';

	import type {
		ExplorerHistoryDetail,
		ExplorerHistoryRow
	} from '../../../models/explorer-ui/Explorer.types';
	import { humanize } from '../../../helpers/strings/humanize';
	import { reviewChanges } from './entityHistory';
	import {
		signedBytes,
		signedCount,
		type HistoryTiming
	} from '../../../utils/explorer-ui/entityHistory';
	import { entityLens, type EntityNav } from '../../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../../helpers/strings/shortCommit';
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

<hx-section
	class="ex-card ex-selected"
	aria-labelledby="ex-change-title"
	data-harness-component="harness-entity-change"
>
	<hx-header class="ex-evidence-head">
		<hx-div>
			<hx-h2 id="ex-change-title">
				Selected change · <hx-span class="ex-mono">{shortCommit(row.commit)}</hx-span> ·
				{row.committedAt.slice(0, 10)}
			</hx-h2>
			<hx-p class="ex-lead">{row.subject}</hx-p>
		</hx-div>
		<HarnessAction href={nav.href(at)} onclick={() => nav.go(at)} tone="plain" icon="arrow-right"
			>View captured state</HarnessAction
		>
		{#if row.previous}
			<HarnessAction href={nav.href(at)} onclick={() => nav.go(at)} icon="arrow-right"
				>Compare with previous</HarnessAction
			>
		{/if}
	</hx-header>
	<hx-div class="ex-change-grid">
		<hx-div>
			<hx-h3>Why it changed</hx-h3>
			{#if detail === null}
				<hx-p class="ex-soft" role="status">Reading what this commit recorded…</hx-p>
			{:else if !detail.known}
				<hx-p class="ex-soft">
					This revision stores no registry or no impact, so what it changed is not known.
				</hx-p>
			{:else if detail.explanations.length === 0}
				<hx-p class="ex-soft">This commit recorded no reason for this entity.</hx-p>
			{/if}
			{#if reasons.notes.length}
				<hx-dl class="ex-rows">
					<hx-div>
						<hx-dt>Behavior</hx-dt>
						<hx-dd>{reasons.behavior.text}</hx-dd>
					</hx-div>
					<hx-div>
						<hx-dt>Simplification</hx-dt>
						<hx-dd
							>{reasons.simplification.text} · {reasons.simplification.outcomes.join(', ')}</hx-dd
						>
					</hx-div>
					<hx-div>
						<hx-dt>Performance</hx-dt>
						<hx-dd>{reasons.performance.text} · {reasons.performance.outcomes.join(', ')}</hx-dd>
					</hx-div>
				</hx-dl>
				<EntityReasons {reasons} bind:open={full} id="ex-reasons-full" />
			{/if}
			{#each row.reviews as review, position (position)}
				<hx-p class="ex-approval">
					<hx-span class="ex-pill gold"
						>{review.type === 'approval'
							? 'Budget increase approved'
							: 'Baseline reviewed'}</hx-span
					>
					<hx-span>{reviewChanges(review).join(', ')}</hx-span>
					<hx-span class="ex-soft">{review.reviewer}: {noted(review.reason).text}</hx-span>
				</hx-p>
				<!-- A note longer than the limit of a body is read whole on request. -->
				{#if noted(review.reason).cut}
					<hx-details class="ex-full">
						<hx-summary
							>Full review note <hx-span class="ex-soft">{review.reviewer}</hx-span></hx-summary
						>
						<hx-p>{review.reason}</hx-p>
					</hx-details>
				{/if}
			{/each}
		</hx-div>
		<hx-div class="ex-scroll">
			<hx-table class="ex-mini" aria-label="Before and after, under matching profiles">
				<hx-thead>
					<hx-tr>
						<hx-th scope="col">Metric</hx-th>
						<hx-th scope="col">Before{row.previous ? ` (${shortCommit(row.previous)})` : ''}</hx-th>
						<hx-th scope="col">After ({shortCommit(row.commit)})</hx-th>
						<hx-th scope="col">Delta</hx-th>
					</hx-tr>
				</hx-thead>
				<hx-tbody>
					{#each lines as line, position (position)}
						<hx-tr>
							<hx-th scope="row">{line.metric}</hx-th>
							<hx-td class:unmeasured={line.before === notMeasured}>{line.before}</hx-td>
							<hx-td class:unmeasured={line.after === notMeasured}>{line.after}</hx-td>
							<hx-td>{line.delta}</hx-td>
						</hx-tr>
					{/each}
				</hx-tbody>
			</hx-table>
		</hx-div>
	</hx-div>
</hx-section>
