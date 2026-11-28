<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_pectymette -->
<script lang="ts">
	import {
		readApprovalPush,
		readHubPush,
		saveQuietHours,
		turnOffApprovalPush,
		turnOffHubPush,
		turnOnApprovalPush,
		turnOnHubPush
	} from '../../lib/networking-security/hubPush';
	import type {
		ApprovalPushRequest,
		HubApprovalPushReading,
		HubPushReading,
		PushQuietHours
	} from '../../lib/networking-security/hubPush.types';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import { deviceHints, onSummary } from './hubHomeNotificationText';
	import HubHomeNotificationSettings from './HubHomeNotificationSettings.svelte';
	import '$reports/lib/styles/hub-home/notifications.css';

	const { api, session } = browserContext();
	const { owner }: { owner: boolean } = $props();
	let push = $state<HubPushReading | null>(null);
	let approval = $state<HubApprovalPushReading | null>(null);
	let busy = $state(false);
	let failed = $state('');
	let editing = $state(false);
	let readTurn = 0;
	const device = $derived(push?.device ?? approval?.device);
	const approvalCall = $derived(
		session.status?.deviceApproval && session.actor
			? session.deviceApproval.push(session.actor.id)
			: null
	);

	/** One change at a time. Resolves to whether it worked, so a dialog stays open on failure. */
	async function change(failure: string, work: () => Promise<void>) {
		busy = true;
		failed = '';
		try {
			await work();
			return true;
		} catch {
			failed = failure;
			return false;
		} finally {
			busy = false;
		}
	}

	async function readApproval() {
		const call = approvalCall;
		if (call) approval = await readApprovalPush(call, push?.device === 'on').catch(() => null);
	}

	async function readNotifications(owner: boolean, call: ApprovalPushRequest | null) {
		const turn = ++readTurn;
		const legacy = owner ? await readHubPush(api).catch(() => null) : null;
		const approved = call
			? await readApprovalPush(call, legacy?.device === 'on').catch(() => null)
			: null;
		if (turn === readTurn) {
			push = legacy;
			approval = approved;
		}
	}

	$effect(() => {
		void readNotifications(owner, approvalCall);
	});

	function turnOn() {
		void change('Notifications could not be turned on. Try again.', async () => {
			if (push) {
				push = await turnOnHubPush(api, push.settings);
				await readApproval();
			} else if (approvalCall && approval) {
				approval = await turnOnApprovalPush(approvalCall, approval.publicKey);
			}
		});
	}

	async function turnOff() {
		const stopped = await change('Notifications could not be turned off. Try again.', async () => {
			if (push) push = await turnOffHubPush(api);
			if (approvalCall && approval?.device === 'on')
				approval = await turnOffApprovalPush(approvalCall, approval.publicKey);
		});
		if (stopped) editing = false;
	}

	async function save(quiet: PushQuietHours) {
		const saved = await change('Quiet hours were not saved. Try again.', async () => {
			if (push) push = { ...push, settings: await saveQuietHours(api, quiet) };
		});
		if (saved) editing = false;
	}
</script>

{#if device}
	<hx-div class="hh-notify" role="group" aria-label="Notifications" data-device={device}>
		{#if device === 'on'}
			<hx-p class="hh-notify-text" role="status"
				>{push ? onSummary(push.settings.quiet) : 'Device approval notifications on'}</hx-p
			>
			{#if push}
				<hx-button
					type="button"
					class="po-action hh-notify-action"
					aria-haspopup="dialog"
					onclick={() => ((failed = ''), (editing = true))}>Notification settings</hx-button
				>
			{:else}
				<hx-button
					type="button"
					class="po-action hh-notify-action"
					disabled={busy}
					onclick={turnOff}>{busy ? 'Turning off…' : 'Turn off notifications'}</hx-button
				>
			{/if}
		{:else}
			{#if device === 'off'}
				<hx-button type="button" class="po-action hh-notify-action" disabled={busy} onclick={turnOn}
					>{busy ? 'Turning on…' : 'Turn on notifications'}</hx-button
				>
			{/if}
			<hx-p class="hh-notify-text"
				>{!push && device === 'off'
					? 'Get device approval requests when this tab is closed.'
					: deviceHints[device]}</hx-p
			>
		{/if}
		{#if failed && !editing}<hx-p class="hh-notify-error" role="alert">{failed}</hx-p>{/if}
	</hx-div>
	{#if editing && push}
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
