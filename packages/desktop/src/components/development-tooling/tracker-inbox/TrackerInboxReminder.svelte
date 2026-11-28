<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_dp6mlj66eq -->
<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import { hasWebLink } from '$reports/utils/strings/linkSegments';
	import type { InboxHeader } from '../../../models/development-tooling/TrackerInbox.types';
	import {
		reminderNextTime,
		snoozeChoices
	} from '$reports/lib/projects-sessions/hub-home/reminderTimes';
	import {
		trackerPersonalName,
		trackerReminderName
	} from '../../../../../../src/utils/projects-sessions/trackerReminderName';

	let {
		header,
		busy,
		open,
		tap,
		onselect
	}: {
		header: InboxHeader;
		busy: boolean;
		/** False once a tap on this time was sent. */
		open: boolean;
		tap: (header: InboxHeader, until?: string) => Promise<void>;
		onselect: (id: string) => void;
	} = $props();
	const reduceMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	let snoozing = $state(false);
	const next = $derived(reminderNextTime(header.reminder!, Date.now()));
	const name = $derived(
		header.reminder?.group === 'work'
			? trackerReminderName(header.title)
			: trackerPersonalName(header.title)
	);
	const linked = $derived(hasWebLink(name));

	function choose(until: string) {
		snoozing = false;
		void tap(header, until);
	}
</script>

<hx-li
	class="reminder"
	data-due={next.due}
	out:slide|global={{ duration: reduceMotion.current ? 0 : 320 }}
>
	<hx-div class="reminder-text">
		{#if linked}<hx-p class="reminder-title"><LinkifiedText text={name} /></hx-p>{/if}
		<hx-button type="button" class="reminder-open" onclick={() => onselect(header.id)}>
			{#if !linked}<hx-span class="reminder-title">{name}</hx-span>{/if}
			<hx-span class="reminder-meta">
				<hx-span class="reminder-when">{next.label}</hx-span>
				{#if next.deadline}<hx-span>{next.deadline}</hx-span>{/if}
				{#if header.reminder?.repeats}<hx-span>{header.reminder.repeats}</hx-span>{/if}
			</hx-span>
		</hx-button>
	</hx-div>
	{#if open}
		<hx-div class="reminder-actions">
			<hx-button
				type="button"
				class="reminder-action"
				aria-label={`Done: ${name}`}
				disabled={busy}
				onclick={() => void tap(header)}>Done</hx-button
			>
			<hx-button
				type="button"
				class="reminder-action"
				aria-label={`Snooze: ${name}`}
				aria-expanded={snoozing}
				disabled={busy}
				onclick={() => (snoozing = !snoozing)}>Snooze</hx-button
			>
		</hx-div>
		{#if snoozing}
			<hx-div class="reminder-actions" role="group" aria-label="Snooze until">
				{#each snoozeChoices(Date.now()) as choice (choice.label)}
					<hx-button type="button" class="reminder-action" onclick={() => choose(choice.until)}
						>{choice.label}</hx-button
					>
				{/each}
			</hx-div>
		{/if}
	{/if}
</hx-li>
