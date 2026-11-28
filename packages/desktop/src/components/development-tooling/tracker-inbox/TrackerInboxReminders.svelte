<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_x6knq6fa2b -->
<script lang="ts">
	import type {
		InboxHeader,
		TrackerInboxSource
	} from '../../../models/development-tooling/TrackerInbox.types';
	import { reminderWrite } from '../../../lib/development-tooling/tracker-inbox/trackerReminders';
	import {
		writeFailureMessage,
		writeSentMessage
	} from '../../../lib/development-tooling/tracker-inbox/trackerInboxMessages';
	import { reminderGroups } from '$reports/lib/projects-sessions/hub-home/reminderGroups';
	import TrackerInboxReminder from './TrackerInboxReminder.svelte';
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
	/** Armed times already acted on here, so a queued tap cannot be sent twice. */
	let acted = $state<string[]>([]);
	const key = (header: InboxHeader) => `${header.id} ${header.reminder?.at}`;
	const groups = $derived(
		reminderGroups(reminders, (header) => ({
			group: header.reminder?.group,
			project: header.project
		}))
	);

	async function tap(header: InboxHeader, until?: string) {
		if (busy) return;
		busy = true;
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
	{#each groups as group (group.id)}
		<hx-h2 class="reminders-group">{group.label}</hx-h2>
		{#each group.sections as section (section.project)}
			{#if section.project}<hx-h3 class="reminders-project">{section.project}</hx-h3>{/if}
			<hx-ul class="reminders-list" aria-label={section.project ?? group.label}>
				{#each section.rows as header (header.id)}
					<TrackerInboxReminder
						{header}
						{busy}
						open={!acted.includes(key(header))}
						{tap}
						{onselect}
					/>
				{/each}
			</hx-ul>
		{:else}
			<hx-p class="reminder-meta">{group.empty}</hx-p>
		{/each}
	{/each}
</hx-section>
