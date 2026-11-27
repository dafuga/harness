<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_v13wsp3cm0 -->
<!-- @harness-uid u_fywzaaju5j -->
<script lang="ts">
	import LinkifiedText from '../../shared-primitives/LinkifiedText.svelte';
	import type { Snippet } from 'svelte';
	import type { TrackerAttachment } from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';
	import type { LoadSpecDocument } from './SpecDocumentView.types';
	import {
		specAttachmentDetail,
		specAttachmentSource
	} from '../../../lib/projects-sessions/spec-view/specAttachmentLabel';
	import SpecDocumentView from './SpecDocumentView.svelte';
	import './viewSpecModal.css';

	let {
		attachment,
		question,
		load,
		answers,
		onclose
	}: {
		attachment: TrackerAttachment;
		question: string;
		load: LoadSpecDocument;
		/** The ask's choices and Other; `close` shuts this modal once one is picked. */
		answers: Snippet<[close: () => void]>;
		onclose: () => void;
	} = $props();
	const source = $derived(specAttachmentSource(attachment));

	function open(element: HTMLDialogElement) {
		element.showModal();
		return () => element.close();
	}
</script>

<hx-dialog
	class="spec-dialog"
	aria-label={specAttachmentDetail(attachment)}
	oncancel={(event: Event) => {
		// A dialog opened from the answers cancels itself without closing the spec.
		if (event.target === event.currentTarget) onclose();
	}}
	{@attach open}
>
	<hx-header class="spec-head">
		<hx-div class="spec-titles">
			<hx-h2>{specAttachmentDetail(attachment)}</hx-h2>
			{#if source}
				<hx-a href={source} target="_blank" rel="noopener noreferrer">
					{attachment.url ? 'Open link' : `GitHub at ${attachment.ref?.slice(0, 12)}`}
				</hx-a>
			{/if}
		</hx-div>
		<hx-button type="button" class="spec-close" onclick={onclose}>Close</hx-button>
	</hx-header>
	<hx-div class="spec-layout">
		<hx-div class="spec-doc" role="region" aria-label="Document" tabindex="0">
			{#if attachment.bytes > 0}
				<SpecDocumentView {attachment} {load} />
			{:else}
				<hx-p class="spec-status">This design opens outside the app. Use the link above.</hx-p>
			{/if}
		</hx-div>
		<hx-div class="spec-answers" role="region" aria-label="Answer">
			<hx-p class="spec-question"><LinkifiedText text={question} /></hx-p>
			{@render answers(onclose)}
		</hx-div>
	</hx-div>
</hx-dialog>
