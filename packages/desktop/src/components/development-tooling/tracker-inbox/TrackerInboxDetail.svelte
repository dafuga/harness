<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_r5yo6df2ta -->
<script lang="ts">
	import './trackerInboxDetail.css';
	import type {
		InboxDetail,
		InboxReply,
		InboxReview,
		TrackerInboxSource,
		WriteAction
	} from '../../../models/development-tooling/TrackerInbox.types';
	import {
		confirmedWrite,
		flagQuestion,
		writeGate
	} from '../../../lib/development-tooling/tracker-inbox/trackerInbox';
	import {
		writeFailureMessage,
		writeSentMessage
	} from '../../../lib/development-tooling/tracker-inbox/trackerInboxMessages';
	import TrackerInboxRecord from './TrackerInboxRecord.svelte';

	let {
		source,
		id,
		onchanged
	}: { source: TrackerInboxSource; id: string; onchanged: () => Promise<void> } = $props();

	let detail = $state.raw<InboxDetail | null>(null);
	let loadMessage = $state('');
	/** The revision the user last reviewed. Set only when the item is opened or reviewed again. */
	let reviewed = $state.raw<InboxReview | null>(null);
	let action = $state<WriteAction | null>(null);
	let confirming = $state(false);
	let text = $state('');
	let message = $state('');
	let busy = $state(false);

	const gate = $derived(
		action && detail
			? writeGate(action, detail, reviewed ? { revision: reviewed.revision } : null)
			: null
	);
	const question = $derived(flagQuestion(detail?.flag ?? null));

	function fresh(reply: InboxReply<InboxDetail>) {
		detail = reply.value ?? null;
		loadMessage = reply.value ? '' : 'This item is not on the phone copy.';
	}

	/** Opening an item is the review. A refresh after a write does not count as one. */
	async function open(target: string) {
		const reply = await source.detail(target);
		if (target !== id) return;
		fresh(reply);
		reviewed = reply.value ? { itemId: target, revision: reply.value.revision } : null;
		cancel();
		message = '';
	}

	async function refresh() {
		fresh(await source.detail(id));
	}

	function cancel() {
		action = null;
		confirming = false;
	}

	function start(next: WriteAction) {
		action = next;
		confirming = false;
		text = '';
		message = '';
	}

	async function send() {
		if (!detail || !action || !reviewed || busy) return;
		const write = confirmedWrite(
			{ action, id: detail.header.id, text, revision: reviewed.revision },
			true
		);
		if (!write) {
			message = 'Write something short before you confirm.';
			return;
		}
		busy = true;
		try {
			const sent = action;
			const reply = await source.write(write);
			message = reply.value ? writeSentMessage(sent) : writeFailureMessage(reply.code);
			if (reply.value) {
				cancel();
				text = '';
			}
			await onchanged();
			await refresh();
		} finally {
			busy = false;
		}
	}

	$effect(() => {
		void open(id);
	});
</script>

{#if detail}
	<hx-article class="detail" aria-label="Item {detail.header.title}">
		<hx-header>
			<hx-h2>{detail.header.title}</hx-h2>
			<hx-p class="meta">{detail.header.project} · {detail.header.id} · {detail.header.status}</hx-p
			>
		</hx-header>

		<TrackerInboxRecord {detail} />

		<hx-section class="actions" aria-label="Confirm a write">
			<hx-div class="buttons">
				<hx-button type="button" onclick={() => start('note')}>Add note</hx-button>
				<hx-button type="button" onclick={() => start('flag')}>Flag for you</hx-button>
				{#if detail.flag?.state === 'open'}
					<hx-button type="button" onclick={() => start('answer')}>Answer flag</hx-button>
				{/if}
				<hx-button type="button" class="quiet" onclick={() => open(id)}>Review again</hx-button>
			</hx-div>

			{#if action && gate && !gate.allowed}
				<hx-p class="meta" role="status">
					{#if gate.reason === 'answered'}
						This flag is already answered. Review the item to see the current state.
					{:else if gate.reason === 'already-open'}
						This item already has an open flag.
					{:else if gate.reason === 'no-flag'}
						There is no flag to answer.
					{:else}
						The item changed since you reviewed it. Review it again before you write.
					{/if}
				</hx-p>
			{:else if action}
				{#if !confirming}
					<hx-label class="draft">
						<hx-span>{action === 'answer' ? `Your answer to: ${question}` : 'Your text'}</hx-span>
						<hx-textarea
							maxlength="512"
							rows="3"
							value={text}
							oninput={(event: Event) =>
								(text = (event.currentTarget as HTMLTextAreaElement).value)}
						></hx-textarea>
					</hx-label>
					<hx-button
						type="button"
						disabled={text.trim() === ''}
						onclick={() => (confirming = true)}
					>
						Review before sending
					</hx-button>
				{:else}
					<hx-div class="confirm" role="group" aria-label="Confirm this write">
						<hx-p>Send this {action} to <hx-strong>{detail.header.title}</hx-strong>?</hx-p>
						<hx-blockquote>{text.trim()}</hx-blockquote>
						<hx-div class="buttons">
							<hx-button type="button" disabled={busy} onclick={send}>Confirm and send</hx-button>
							<hx-button type="button" class="quiet" onclick={() => (confirming = false)}
								>Edit</hx-button
							>
							<hx-button type="button" class="quiet" onclick={cancel}>Cancel</hx-button>
						</hx-div>
					</hx-div>
				{/if}
			{/if}
			{#if message}<hx-p class="meta" role="status">{message}</hx-p>{/if}
		</hx-section>
	</hx-article>
{:else if loadMessage}
	<hx-p class="meta" role="status">{loadMessage}</hx-p>
{/if}
