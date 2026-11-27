<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_pectymette -->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		readHubPush,
		saveQuietHours,
		turnOffHubPush,
		turnOnHubPush
	} from '../../lib/networking-security/hubPush';
	import type { HubPushReading, PushQuietHours } from '../../lib/networking-security/hubPush.types';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import { deviceHints, onSummary } from './hubHomeNotificationText';
	import HubHomeNotificationSettings from './HubHomeNotificationSettings.svelte';
	import '$reports/lib/styles/hub-home/notifications.css';

	const { api } = browserContext();
	let push = $state<HubPushReading | null>(null);
	let busy = $state(false);
	let failed = $state('');
	let editing = $state(false);

	/** One change at a time. Resolves to whether it worked, so a dialog stays open on failure. */
	async function change(failure: string, work: () => Promise<HubPushReading | null>) {
		busy = true;
		failed = '';
		try {
			push = await work();
			return true;
		} catch {
			failed = failure;
			return false;
		} finally {
			busy = false;
		}
	}

	// A Hub without notifications, or one that cannot be read now, simply shows no row.
	onMount(() => {
		void readHubPush(api).then(
			(value) => (push = value),
			() => {}
		);
	});

	function turnOn() {
		const settings = push!.settings;
		void change('Notifications could not be turned on. Try again.', () =>
			turnOnHubPush(api, settings)
		);
	}

	async function turnOff() {
		if (
			await change('Notifications could not be turned off. Try again.', () => turnOffHubPush(api))
		)
			editing = false;
	}

	async function save(quiet: PushQuietHours) {
		const saved = await change('Quiet hours were not saved. Try again.', async () => ({
			...push!,
			settings: await saveQuietHours(api, quiet)
		}));
		if (saved) editing = false;
	}
</script>

{#if push}
	<hx-div class="hh-notify" role="group" aria-label="Notifications" data-device={push.device}>
		{#if push.device === 'on'}
			<hx-p class="hh-notify-text" role="status">{onSummary(push.settings.quiet)}</hx-p>
			<hx-button
				type="button"
				class="po-action hh-notify-action"
				aria-haspopup="dialog"
				onclick={() => ((failed = ''), (editing = true))}>Notification settings</hx-button
			>
		{:else}
			{#if push.device === 'off'}
				<hx-button type="button" class="po-action hh-notify-action" disabled={busy} onclick={turnOn}
					>{busy ? 'Turning on…' : 'Turn on notifications'}</hx-button
				>
			{/if}
			<hx-p class="hh-notify-text">{deviceHints[push.device]}</hx-p>
		{/if}
		{#if failed && !editing}<hx-p class="hh-notify-error" role="alert">{failed}</hx-p>{/if}
	</hx-div>
	{#if editing}
		<HubHomeNotificationSettings
			quiet={push.settings.quiet}
			deliveredAt={push.deliveredAt}
			{busy}
			{failed}
			{save}
			{turnOff}
			close={() => (editing = false)}
		/>
	{/if}
{/if}
