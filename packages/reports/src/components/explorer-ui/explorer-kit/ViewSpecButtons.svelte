<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_v13wsp3cb1 -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { TrackerAttachment } from '../../../../../../src/utils/projects-sessions/trackerAttachment.types';
	import type { LoadSpecDocument } from './SpecDocumentView.types';
	import {
		specAttachmentAction,
		specAttachmentDetail
	} from '../../../lib/projects-sessions/spec-view/specAttachmentLabel';
	import ViewSpecModal from './ViewSpecModal.svelte';

	let {
		attachments,
		question,
		load,
		answers
	}: {
		attachments: TrackerAttachment[];
		question: string;
		load: LoadSpecDocument;
		answers: Snippet<[close: () => void]>;
	} = $props();
	let viewing = $state<TrackerAttachment | null>(null);
</script>

<hx-div class="view-spec-buttons">
	{#each attachments as attachment (attachment.id)}
		<hx-button
			type="button"
			class="view-spec-button"
			aria-haspopup="dialog"
			onclick={() => (viewing = attachment)}
		>
			<hx-strong>{specAttachmentAction(attachment)}</hx-strong>
			<hx-span>· {specAttachmentDetail(attachment)}</hx-span>
		</hx-button>
	{/each}
</hx-div>

{#if viewing}
	<ViewSpecModal attachment={viewing} {question} {load} {answers} onclose={() => (viewing = null)} />
{/if}

<style>
	:global(.view-spec-buttons) {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-8);
		margin-block: var(--hx-space-8);
	}
	:global(.view-spec-buttons button.view-spec-button) {
		max-width: 100%;
		min-height: var(--hx-space-40);
		padding: var(--hx-space-8) var(--hx-space-12);
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: var(--hx-radius-compact);
		background: var(--hx-color-surface);
		color: var(--hx-color-text);
		font: inherit;
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	:global(.view-spec-button span) {
		color: var(--hx-color-text-supporting);
	}
</style>
