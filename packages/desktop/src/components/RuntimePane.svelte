<script lang="ts">
	import type { Evidence } from '../../../reports/src/models/Report.types';
	import type { EntityEvidence } from '../lib/stores/entityEvidence.svelte';
	import StatusIcon from './StatusIcon.svelte';
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

<figure class="runtime-pane" aria-label={title}>
	<figcaption><strong>{title}</strong><span class="chip">{role}</span></figcaption>
	{#if item.missing}<p class="runtime-gap">
			<StatusIcon status="failed" reason="No capture" /><span>{item.note}</span>
		</p>{:else if problem}<p class="runtime-gap">
			<StatusIcon status="failed" reason="Not verified" /><span>{problem}</span>
		</p>{:else if url}<img src={url} alt={`${item.title} at ${item.viewport}`} />
		<p class="runtime-standing" class:stale={item.standing !== 'Fresh capture'}>
			{item.standing} · {item.status}
		</p>{:else}<p class="muted">Reading the capture…</p>{/if}
</figure>
