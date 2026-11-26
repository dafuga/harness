<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type {
		ConfirmedWrite,
		InboxDetail,
		TrackerInboxSource
	} from '../../../models/development-tooling/TrackerInbox.types';
	import {
		optionWrite,
		writtenAnswer
	} from '../../../lib/development-tooling/tracker-inbox/trackerInbox';
	import {
		writeFailureMessage,
		writeSentMessage
	} from '../../../lib/development-tooling/tracker-inbox/trackerInboxMessages';
	import TrackerInboxChoices from './TrackerInboxChoices.svelte';

	let {
		source,
		review,
		mode,
		onchanged,
		onsent
	}: {
		source: TrackerInboxSource;
		/** The read this row shows. A tap answers its revision, or is refused if that moved on. */
		review: InboxDetail;
		mode: 'phone' | 'mac';
		onchanged: () => Promise<void>;
		/** The list says the answer went: an answered row leaves it on the next read. */
		onsent: (message: string) => void;
	} = $props();

	let busy = $state(false);
	let message = $state('');
	/** The revision already answered here, so a queued answer cannot be tapped twice. */
	let answered = $state<string | null>(null);
	const reviewed = $derived({ itemId: review.header.id, revision: review.revision });

	async function deliver(write: ConfirmedWrite | null) {
		if (!write || busy) {
			message = 'This ask cannot be answered from here. Open the item and review it.';
			return;
		}
		busy = true;
		try {
			const reply = await source.write(write);
			message = reply.value ? '' : writeFailureMessage(reply.code, mode);
			if (reply.value) {
				answered = write.revision;
				onsent(writeSentMessage('answer', mode));
			}
			await onchanged();
		} finally {
			busy = false;
		}
	}
</script>

{#if review.flag && (answered === null || answered !== review.revision)}
	<TrackerInboxChoices
		flag={review.flag}
		{busy}
		onpick={(number) => void deliver(optionWrite(review, reviewed, number))}
		onother={(text) => void deliver(writtenAnswer(review, reviewed, text))}
	/>
{/if}
{#if message}<hx-p class="hint" role="status">{message}</hx-p>{/if}
