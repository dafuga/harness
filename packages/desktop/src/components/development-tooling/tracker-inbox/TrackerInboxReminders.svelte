<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_x6knq6fa2b -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import { hasWebLink } from '$reports/utils/strings/linkSegments';
	import type {
		InboxHeader,
		TrackerInboxSource
	} from '../../../models/development-tooling/TrackerInbox.types';
	import { reminderWrite } from '../../../lib/development-tooling/tracker-inbox/trackerReminders';
	import {
		writeFailureMessage,
		writeSentMessage
	} from '../../../lib/development-tooling/tracker-inbox/trackerInboxMessages';
	import {
		reminderNextTime,
		snoozeChoices
	} from '$reports/lib/projects-sessions/hub-home/reminderTimes';
	import { trackerReminderName } from '../../../../../../src/utils/projects-sessions/trackerPersonalReminder';
	import './trackerInboxReminders.css';

	let {
		source,
		mode,
		reminders,
		onchanged,
		onnotice,
		onselect
	}: {
		source: TrackerInboxSource;
		mode: 'phone' | 'mac';
		reminders: InboxHeader[];
		onchanged: () => Promise<void>;
		onnotice: (message: string) => void;
		onselect: (id: string) => void;
	} = $props();
	let busy = $state(false);
	let snoozing = $state<string | null>(null);
	/** Armed times already acted on here, so a queued tap cannot be sent twice. */
	let acted = $state<string[]>([]);
	const key = (header: InboxHeader) => `${header.id} ${header.reminder?.at}`;

	async function tap(header: InboxHeader, until?: string) {
		if (busy) return;
		busy = true;
		snoozing = null;
		try {
			const write = reminderWrite(header, until);
			const reply = await source.write(write);
			if (reply.value) acted = [...acted, key(header)];
			onnotice(
				reply.value ? writeSentMessage(write.action, mode) : writeFailureMessage(reply.code, mode)
			);
			await onchanged();
		} finally {
			busy = false;
		}
	}
</script>

<hx-section class="reminders" aria-label="Reminders">
	<hx-h2 class="reminders-group" id="inbox-reminders-personal">Personal</hx-h2>
	<hx-ul class="reminders-list" aria-labelledby="inbox-reminders-personal">
		{#each reminders as header (header.id)}
			{@const next = reminderNextTime(header.reminder!.at, Date.now())}
			{@const name = trackerReminderName(header.title)}
			{@const linked = hasWebLink(name)}
			<hx-li class="reminder" data-due={next.due}>
				<hx-div class="reminder-text">
					{#if linked}<hx-p class="reminder-title"><LinkifiedText text={name} /></hx-p>{/if}
					<hx-button type="button" class="reminder-open" onclick={() => onselect(header.id)}>
						{#if !linked}<hx-span class="reminder-title">{name}</hx-span>{/if}
						<hx-span class="reminder-meta">
							<hx-span class="reminder-when">{next.label}</hx-span>
							{#if header.reminder?.repeats}<hx-span>{header.reminder.repeats}</hx-span>{/if}
						</hx-span>
					</hx-button>
				</hx-div>
				{#if !acted.includes(key(header))}
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
							aria-expanded={snoozing === header.id}
							disabled={busy}
							onclick={() => (snoozing = snoozing === header.id ? null : header.id)}
							>Snooze</hx-button
						>
					</hx-div>
					{#if snoozing === header.id}
						<hx-div class="reminder-actions" role="group" aria-label="Snooze until">
							{#each snoozeChoices(Date.now()) as choice (choice.label)}
								<hx-button
									type="button"
									class="reminder-action"
									onclick={() => void tap(header, choice.until)}>{choice.label}</hx-button
								>
							{/each}
						</hx-div>
					{/if}
				{/if}
			</hx-li>
		{:else}
			<hx-li><hx-p class="reminder-meta">No personal reminders.</hx-p></hx-li>
		{/each}
	</hx-ul>
</hx-section>
