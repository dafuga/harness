<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ycwjobdetl -->
<script lang="ts">
	import Modal from '$reports/components/Modal.svelte';
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import type { HomeWorkRow } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
	import {
		stageLabel,
		statusWords,
		workAge,
		workFacts,
		workNow,
		workStateLabel,
		workTimes
	} from './hubHomeLive';

	let {
		row,
		now,
		state,
		facts = [],
		reason,
		close
	}: {
		row: HomeWorkRow;
		now: number;
		/** The state in words when the caller names it differently from the row. */
		state?: string;
		/** What the opener knows beyond the row, such as the item's project and priority. */
		facts?: string[];
		reason?: string | null;
		close: () => void;
	} = $props();
	const text = $derived(reason ?? workNow(row));
</script>

<Modal isOpen title="Job details" variant="section" onClose={close}>
	<hx-div class="hh-live-detail">
		<hx-h3><LinkifiedText text={row.title} /></hx-h3>
		{#if facts.length}<hx-p class="hh-live-detail-facts">{facts.join(' · ')}</hx-p>{/if}
		<hx-p class="hh-live-detail-facts">
			{state ?? workStateLabel(row)} · {statusWords[row.status]}
			{#if stageLabel(row.stage)}
				· {stageLabel(row.stage)}{/if}
		</hx-p>
		<hx-p class="hh-live-detail-facts">{workFacts(row).join(' · ')}</hx-p>
		<hx-p class="hh-live-detail-facts">{workAge(row, now)} · {workTimes(row)}</hx-p>
		{#if text}<hx-p><LinkifiedText {text} /></hx-p>{/if}
	</hx-div>
</Modal>
