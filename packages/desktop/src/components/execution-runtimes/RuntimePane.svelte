<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Notice from '$shared/explorer-ui/explorer-kit/Notice.svelte';
	import Pill from '$shared/explorer-ui/explorer-kit/Pill.svelte';
	import { errorMessage } from '$reports/helpers/strings/errorMessage';

	import type { Evidence } from '$reports/models/reports-media/Report.types';
	import type { EntityEvidence } from '../../lib/stores/explorer-ui/entityEvidence.svelte';
	import Status from '$shared/shared-primitives/status/Status.svelte';
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
			(cause: unknown) => live && (problem = errorMessage(cause))
		);
		return () => {
			live = false;
		};
	});
</script>

<hx-figure class="runtime-pane" aria-label={title}>
	<hx-figcaption
		><hx-strong>{title}</hx-strong><Pill as="span" variant="chip" tone="runtime-pane-chip"
			>{role}</Pill
		></hx-figcaption
	>
	{#if item.missing}<Notice as="p" className="runtime-gap runtime-pane-runtime-gap">
			<Status variant="icon" status="failed" reason="No capture" /><hx-span>{item.note}</hx-span>
		</Notice>{:else if problem}<Notice as="p" className="runtime-gap runtime-pane-runtime-gap">
			<Status variant="icon" status="failed" reason="Not verified" /><hx-span>{problem}</hx-span>
		</Notice>{:else if url}<hx-img src={url} alt={`${item.title} at ${item.viewport}`} />
		<hx-p class="runtime-standing" class:stale={item.standing !== 'Fresh capture'}>
			{item.standing} · {item.status}
		</hx-p>{:else}<hx-p class="muted">Reading the capture…</hx-p>{/if}
</hx-figure>
