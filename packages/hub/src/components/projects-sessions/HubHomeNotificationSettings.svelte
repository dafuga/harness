<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_r6xro6gszn -->
<script lang="ts">
	import { untrack } from 'svelte';
	import Modal from '$reports/components/Modal.svelte';
	import type { PushQuietHours } from '../../lib/networking-security/hubPush.types';
	import { lastDelivery } from './hubHomeNotificationText';

	let {
		quiet,
		deliveredAt,
		busy,
		failed,
		save,
		turnOff,
		close
	}: {
		quiet: PushQuietHours;
		deliveredAt: number | null;
		busy: boolean;
		failed: string;
		save: (quiet: PushQuietHours) => void;
		turnOff: () => void;
		close: () => void;
	} = $props();
	// The dialog edits its own copy; nothing changes until Save.
	const initial = untrack(() => quiet);
	let enabled = $state(initial.enabled);
	let start = $state(initial.start);
	let end = $state(initial.end);
	const opened = Date.now();

	function submit(event: SubmitEvent) {
		event.preventDefault();
		save({ enabled, start, end });
	}
</script>

<Modal isOpen title="Notifications" variant="text" onClose={close}>
	<hx-form class="hh-notify-form" onsubmit={submit}>
		<hx-p class="hh-notify-text"
			>One notification covers every open decision. It is sent when a new one appears, then every 15
			minutes while any stays open.</hx-p
		>
		<hx-label class="hh-notify-check">
			<hx-input-checkbox
				checked={enabled}
				onchange={(event: Event) => (enabled = (event.currentTarget as HTMLInputElement).checked)}
			/>
			<hx-span>Quiet hours (Lisbon time)</hx-span>
		</hx-label>
		<hx-div class="hh-notify-times">
			<hx-label class="hh-notify-time">
				<hx-span>From</hx-span>
				<hx-input-time
					required
					disabled={!enabled}
					value={start}
					onchange={(event: Event) => (start = (event.currentTarget as HTMLInputElement).value)}
				/>
			</hx-label>
			<hx-label class="hh-notify-time">
				<hx-span>Until</hx-span>
				<hx-input-time
					required
					disabled={!enabled}
					value={end}
					onchange={(event: Event) => (end = (event.currentTarget as HTMLInputElement).value)}
				/>
			</hx-label>
		</hx-div>
		<hx-p class="hh-notify-text">{lastDelivery(deliveredAt, opened)}</hx-p>
		{#if failed}<hx-p class="hh-notify-error" role="alert">{failed}</hx-p>{/if}
		<hx-div class="hh-notify-buttons">
			<hx-button type="button" class="po-action" disabled={busy} onclick={turnOff}
				>Turn off on this device</hx-button
			>
			<hx-button type="submit" class="po-action hh-primary" disabled={busy || !start || !end}
				>Save</hx-button
			>
		</hx-div>
	</hx-form>
</Modal>
