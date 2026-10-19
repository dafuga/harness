<script lang="ts">
	import { writingLimits } from '../../../../../../src/utils/writing-limits/writingLimits';
	import type {
		ExplorerHistoryDetail,
		ExplorerHistoryRow,
		ExplorerLocation,
		ExplorerVerdict
	} from '../../../models/Explorer.types';
	import type { HarnessMark } from '../../../models/Harness.types';
	import { signedBytes, signedCount, type HistoryTiming } from '../../../utils/entityHistory';
	import { shortCommit, type EntityNav } from '../../../utils/entityLens';
	import { byteSize, notMeasured } from '../../../utils/entityMeasure';
	import { boundedText, entityReasons } from '../../../utils/entityReasons';
	import { reasonsTried } from './entityReasons';
	import EntityLink from '../EntityLink.svelte';
	import HarnessIcon from '../HarnessIcon.svelte';
	import HarnessVerdict from '../harness-verdict/HarnessVerdict.svelte';
	let {
		row,
		detail,
		timing,
		verdict,
		selected,
		viewed,
		to,
		nav,
		onselect
	}: {
		row: ExplorerHistoryRow;
		/** What the revision of the commit says about the entity; nothing until it has been read. */
		detail: ExplorerHistoryDetail | undefined;
		/** The timing of the chosen profile at this commit, when it has one. */
		timing: HistoryTiming | undefined;
		verdict: Pick<ExplorerVerdict, 'passed' | 'label'> & { reasons?: string[] };
		selected: boolean;
		viewed: boolean;
		/** The entity at this commit, where it is compared with its own parent. */
		to: ExplorerLocation;
		nav: EntityNav;
		/** Shows this change below; `full` asks for its reasons as they were written. */
		onselect: (full: boolean) => void;
	} = $props();
	const pills: Record<HarnessMark, string> = {
		added: 'Added',
		removed: 'Removed',
		direct: '',
		indirect: ''
	};
	let hash = $derived(shortCommit(row.commit));
	let reasons = $derived(entityReasons(detail?.explanations ?? []));
	let tried = $derived(reasonsTried(reasons));
	// A commit that recorded no reason is told by its subject, held to the limit of one.
	let subject = $derived(boundedText([row.subject], writingLimits.subject).text);
	let change = $derived(pills[row.change ?? detail?.change ?? 'direct']);
	let size = $derived(row.measured?.size ?? null);
	let complexity = $derived(row.measured?.complexity ?? null);
</script>

<tr class:selected class:viewed>
	<td>{row.committedAt.slice(0, 10)}</td>
	<td>
		<button type="button" class="ex-hash" aria-pressed={selected} onclick={() => onselect(false)}
			>{hash}</button
		>
		{#if viewed}<span class="ex-pill gold">Viewed commit</span>{/if}
		{#if change}<span class="ex-pill">{change}</span>{/if}
	</td>
	<td class="ex-said">
		{reasons.behavior.text || subject}
		{#if reasons.long}
			<button
				type="button"
				class="ex-text-button"
				aria-label={`Full reasons of ${hash}`}
				onclick={() => onselect(true)}>Full reasons</button
			>
		{/if}
	</td>
	<td class="ex-said">
		{#each tried as text, position (position)}<span class="ex-block">{text}</span>{:else}—{/each}
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
	<td><HarnessVerdict {...verdict} /></td>
	<td class="ex-open">
		<EntityLink {to} {nav} label={`View revision ${hash}`}
			>View revision <HarnessIcon name="arrow-right" size={16} /></EntityLink
		>
	</td>
</tr>
