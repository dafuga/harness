<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_eaodnfratq -->
<script lang="ts">
	import type { InboxFlag } from '../../../models/development-tooling/TrackerInbox.types';
	import { flagQuestion } from '../../../lib/development-tooling/tracker-inbox/trackerInbox';
	import ViewSpecButtons from '../../../../../reports/src/components/explorer-ui/explorer-kit/ViewSpecButtons.svelte';
	import type { LoadSpecDocument } from '../../../../../reports/src/components/explorer-ui/explorer-kit/SpecDocumentView.types';
	import TrackerInboxChoices from './TrackerInboxChoices.svelte';

	let {
		flag,
		busy,
		onpick,
		onother,
		load
	}: {
		flag: InboxFlag;
		busy: boolean;
		onpick: (number: number) => void;
		onother: (text: string) => void;
		load: LoadSpecDocument;
	} = $props();

	/** Only a flag with choices is Daniel's decision; any other open flag is Chief of Staff's. */
	const title = $derived(
		flag.state !== 'open' ? 'Flag answered' : flag.options ? 'Needs you' : 'Open flag'
	);

	/** Opening the chat lands on the question, below the earlier messages. */
	function reveal(element: HTMLElement) {
		requestAnimationFrame(() => element.scrollIntoView({ block: 'nearest' }));
	}
</script>

<hx-section class="flag" data-flag-state={flag.state} {@attach reveal}>
	<hx-h3>{title}</hx-h3>
	<hx-p>{flagQuestion(flag)}</hx-p>
	{#if flag.state === 'open'}
		{#if flag.options && flag.attachments}
			<ViewSpecButtons attachments={flag.attachments} question={flagQuestion(flag)} {load}>
				{#snippet answers(close: () => void)}
					<TrackerInboxChoices
						{flag}
						{busy}
						onpick={(number) => {
							close();
							onpick(number);
						}}
						onother={(text) => {
							close();
							onother(text);
						}}
					/>
				{/snippet}
			</ViewSpecButtons>
		{/if}
		<TrackerInboxChoices {flag} {busy} {onpick} {onother} />
	{/if}
</hx-section>
