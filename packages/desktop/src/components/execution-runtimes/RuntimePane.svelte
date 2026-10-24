<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Evidence } from '../../../../reports/src/models/Report.types';
	import type { EntityEvidence } from '../../lib/stores/explorer-ui/entityEvidence.svelte';
	import StatusIcon from '../shared-primitives/StatusIcon.svelte';
	let {
		item,
		title,
		role,
		evidence
	}: {
		/** One side at the picked state: its capture, or its gap in the words of the record. */
		item: Evidence;
		title: string;
		role: string;
		evidence: EntityEvidence;
	} = $props();
	let url = $state('');
	let problem = $state('');
	/** The bytes are read through the bridge and checked; nothing is shown before that. */
	$effect(() => {
		const { missing, file, phase } = item;
		url = '';
		problem = '';
		if (missing) return;
		let live = true;
		evidence.url(phase === 'before' ? 'before' : 'after', file).then(
			(value) => live && (url = value),
			(cause: unknown) => live && (problem = cause instanceof Error ? cause.message : String(cause))
		);
		return () => {
			live = false;
		};
	});
</script>

<hx-figure class="runtime-pane" aria-label={title}>
	<hx-figcaption><hx-strong>{title}</hx-strong><hx-span class="chip">{role}</hx-span></hx-figcaption
	>
	{#if item.missing}<hx-p class="runtime-gap">
			<StatusIcon status="failed" reason="No capture" /><hx-span>{item.note}</hx-span>
		</hx-p>{:else if problem}<hx-p class="runtime-gap">
			<StatusIcon status="failed" reason="Not verified" /><hx-span>{problem}</hx-span>
		</hx-p>{:else if url}<hx-img src={url} alt={`${item.title} at ${item.viewport}`} />
		<hx-p class="runtime-standing" class:stale={item.standing !== 'Fresh capture'}>
			{item.standing} · {item.status}
		</hx-p>{:else}<hx-p class="muted">Reading the capture…</hx-p>{/if}
</hx-figure>
