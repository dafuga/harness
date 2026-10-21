<script lang="ts">
	import { writingLimits } from '../../../../../../../src/utils/writing-limits/writingLimits';
	import type {
		ExplorerHistoryDetail,
		ExplorerHistoryRow,
		ExplorerLocation,
		ExplorerVerdict
	} from '../../../../models/explorer-ui/Explorer.types';
	import { signedBytes, signedCount, type HistoryTiming } from '../../../../utils/explorer-ui/entityHistory';
	import { shortCommit, type EntityNav } from '../../../../utils/explorer-ui/entityLens';
	import { byteSize, notMeasured } from '../../../../utils/explorer-ui/entityMeasure';
	import { boundedText, entityReasons } from '../../../../utils/explorer-ui/entityReasons';
	import { timeAgo } from '../../../../utils/reports-media/reportDisplay';
	import EntityReasons from '../entity-reasons/EntityReasons.svelte';
	import EntityLink from '../EntityLink.svelte';
	let {
		row,
		detail,
		timing,
		viewed,
		to,
		nav
	}: {
		row: ExplorerHistoryRow;
		/** What the revision of the commit says about the entity; nothing until it has been read. */
		detail: ExplorerHistoryDetail | undefined;
		/** The timing of the chosen profile at this commit, when it has one. */
		timing: HistoryTiming | undefined;
		verdict?: Pick<ExplorerVerdict, 'passed' | 'label'> & { reasons?: string[] };
		selected?: boolean;
		viewed: boolean;
		/** The entity at this commit, where it is compared with its own parent. */
		to: ExplorerLocation;
		nav: EntityNav;
		/** Shows this change below; `full` asks for its reasons as they were written. */
		onselect?: (full: boolean) => void;
	} = $props();
	let hash = $derived(shortCommit(row.commit));
	let reasons = $derived(entityReasons(detail?.explanations ?? []));
	// A commit that recorded no reason is told by its subject, held to the limit of one.
	let subject = $derived(boundedText([row.subject], writingLimits.subject).text);
	let size = $derived(row.measured?.size ?? detail?.sourceSize ?? null);
	let complexity = $derived(row.measured?.complexity ?? detail?.sourceComplexity ?? null);
</script>

<tr class:viewed>
	<td><time datetime={row.committedAt} title={row.committedAt}>{timeAgo(row.committedAt, Date.now(), 'always')}</time></td>
	<td>
		<EntityLink {to} {nav} class="ex-hash">{hash}</EntityLink>
		{#if viewed}<span class="ex-pill gold">Viewed commit</span>{/if}
		<EntityReasons {reasons} />
	</td>
	<td class="ex-said">
		{reasons.behavior.text || subject}
	</td>
	<td class:unmeasured={size === null}>
		{size === null ? notMeasured : byteSize(size)}
		<span class="ex-soft ex-block">{signedBytes(row.sizeChange)}</span>
		{#if row.reviews.some((review) => review.type === 'approval')}
			<span class="ex-pill gold wraps">Budget increase approved</span>
		{/if}
	</td>
	<td class:unmeasured={complexity === null}>
		{complexity ?? notMeasured}
		<span class="ex-soft ex-block">{signedCount(row.complexityChange)}</span>
	</td>
	<td class:unmeasured={!timing}>
		{#if timing}
			{timing.before === undefined ? '' : `${timing.before} → `}{timing.after}
			{timing.unit}
		{:else}{notMeasured}{/if}
	</td>
</tr>
