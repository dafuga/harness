<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_mbc4eqnvtp -->
<script lang="ts">
	import Modal from '../../Modal.svelte';
	import LinkifiedText from '../../shared-primitives/LinkifiedText.svelte';
	import { outgoingChannels, outgoingHref } from './hubHomeOutgoingDraft';
	import type { HomeOutgoingActions, HomeOutgoingDraft } from './hubHomeOutgoingDraft.types';

	let {
		draft,
		save,
		close
	}: {
		draft: HomeOutgoingDraft;
		save: HomeOutgoingActions['edit'];
		close: (record: HomeOutgoingDraft) => void;
	} = $props();

	const source = $derived(draft.message);
	const email = $derived(source.channel === 'gmail');
	const subjectField = $derived(email || source.subject !== undefined);
	const ccField = $derived(email || source.cc.length > 0);
	const thread = $derived(outgoingHref(source.thread?.url));
	const initial = () => draft.message;
	let recipients = $state(initial().to.join(', '));
	let copies = $state(initial().cc.join(', '));
	let subject = $state(initial().subject ?? '');
	let body = $state(initial().body);
	let pending = $state(false);
	let error = $state('');

	function addresses(value: string) {
		return value
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);
	}

	const requestClose = () => close(draft);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!body.trim() || !addresses(recipients).length || pending) return;
		const { id, revision } = draft;
		pending = true;
		error = '';
		try {
			await save(
				{ id, revision },
				{
					to: addresses(recipients),
					cc: ccField ? addresses(copies) : source.cc,
					...(subjectField && { subject: subject.trim() }),
					body
				}
			);
			requestClose();
		} catch {
			error = 'Could not save changes. Reopen the draft to review its latest version.';
		} finally {
			pending = false;
		}
	}
</script>

<Modal isOpen title="Edit draft" variant="section" onClose={requestClose}>
	<hx-form id="outgoing-draft-editor" class="outgoing-editor" onsubmit={submit}>
		<hx-div class="outgoing-context">
			<hx-p>{outgoingChannels[source.channel].label} · {source.account}</hx-p>
			{#if source.thread}
				<hx-p
					>In reply to
					{#if thread}<hx-a href={thread} target="_blank" rel="noopener noreferrer"
							>{source.thread.label}</hx-a
						>
					{:else}<LinkifiedText text={source.thread.label} />{/if}
				</hx-p>
			{/if}
		</hx-div>
		<hx-label
			>{source.channel === 'post' ? 'Destination' : 'To'}
			<hx-input bind:value={recipients} required />
		</hx-label>
		{#if ccField}<hx-label>Cc <hx-input bind:value={copies} /></hx-label>{/if}
		{#if subjectField}<hx-label>Subject <hx-input bind:value={subject} /></hx-label>{/if}
		<hx-label>Message <hx-textarea bind:value={body} rows={6} required></hx-textarea></hx-label>
		{#if error}<hx-p class="outgoing-edit-error" role="alert">{error}</hx-p>{/if}
	</hx-form>
	{#snippet footer()}
		<hx-div class="outgoing-editor-actions">
			<hx-button type="button" class="po-action" onclick={requestClose}>Cancel</hx-button>
			<hx-button
				type="submit"
				class="po-action outgoing-save"
				form="outgoing-draft-editor"
				disabled={pending || !body.trim() || !addresses(recipients).length}
			>
				{pending ? 'Saving' : 'Save changes'}
			</hx-button>
		</hx-div>
	{/snippet}
</Modal>

<style>
	.outgoing-editor {
		display: grid;
		gap: var(--hx-space-12);
	}
	.outgoing-context {
		display: grid;
		gap: var(--hx-space-4);
		overflow-wrap: anywhere;
		color: var(--hx-color-text-supporting);
	}
	.outgoing-context p {
		margin: 0;
	}
	.outgoing-context a {
		color: var(--home-accent, var(--hx-color-primary));
		text-decoration: underline;
		text-underline-offset: var(--hx-space-3);
	}
	label {
		display: grid;
		gap: var(--hx-space-4);
	}
	input,
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: var(--hx-space-44);
		padding: var(--hx-space-10);
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: var(--hx-radius-compact);
		background: var(--hx-color-background);
		color: var(--hx-color-text);
		font-size: var(--hx-type-size-base);
	}
	textarea {
		resize: vertical;
	}
	.outgoing-edit-error {
		color: var(--hx-color-error);
	}
	.outgoing-editor-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--hx-space-8);
		padding: var(--hx-space-12) var(--hx-space-24);
		padding-bottom: max(var(--hx-space-12), env(safe-area-inset-bottom));
		border-top: var(--hx-border-thin) solid var(--hx-color-border);
	}
	.outgoing-editor-actions button {
		min-height: var(--hx-space-44);
	}
	.outgoing-editor-actions .outgoing-save {
		border-color: transparent;
		background: var(--hx-color-primary);
		color: var(--hx-color-primary-contrast);
	}
	.outgoing-save:disabled {
		opacity: 0.56;
		cursor: default;
	}
	:global(.hh-home dialog.hh-dialog:has(.outgoing-editor)) {
		width: min(34rem, calc(100vw - var(--hx-space-32)));
	}
	@media (max-width: 560px) {
		:global(.hh-home dialog.hh-dialog:has(.outgoing-editor)) {
			width: 100%;
		}
	}
</style>
