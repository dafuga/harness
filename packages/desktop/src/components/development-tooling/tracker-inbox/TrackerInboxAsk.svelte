<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_eaodnfratq -->
<script lang="ts">
	import type { InboxFlag } from '../../../models/development-tooling/TrackerInbox.types';
	import { flagQuestion } from '../../../lib/development-tooling/tracker-inbox/trackerInbox';
	import TrackerInboxChoices from './TrackerInboxChoices.svelte';

	let {
		flag,
		busy,
		onpick,
		onother
	}: {
		flag: InboxFlag;
		busy: boolean;
		onpick: (number: number) => void;
		onother: (text: string) => void;
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
		<TrackerInboxChoices {flag} {busy} {onpick} {onother} />
	{/if}
</hx-section>
