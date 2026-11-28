<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_v254xv7vyx -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import Card from '$shared/explorer-ui/explorer-kit/Card.svelte';
	import Modal from '$shared/shared-primitives/Modal.svelte';
	import type {
		DeviceApprovalHandler,
		DeviceApprovalRequest
	} from '../../models/development-tooling/Environment.types';
	let { request }: { request: DeviceApprovalHandler } = $props();
	let requests = $state<DeviceApprovalRequest[]>([]);
	let selected = $state<DeviceApprovalRequest>();
	let code = $state('');
	let busy = $state(false);
	let notice = $state('');
	let error = $state('');
	let active = false;
	let reading = false;
	let turn = 0;
	let comparing = false;
	let reducedMotion = $state(false);
	const regions = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
	const time = new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Lisbon'
	});
	function device(item: DeviceApprovalRequest) {
		if (item.platform === 'iphone') return 'Harness iPhone';
		if (item.platform === 'mac') return 'Harness Mac';
		if (item.platform === 'web') return 'Harness Hub';
		return 'Harness device';
	}
	function details(item: DeviceApprovalRequest) {
		const country = item.country ? regions.of(item.country) : undefined;
		return [country, time.format(item.createdAt)].filter(Boolean).join(' · ');
	}
	async function refresh() {
		if (!active || reading || busy) return;
		reading = true;
		const asked = turn;
		try {
			const answer = await request({ action: 'list' });
			if (active && asked === turn && 'requests' in answer) requests = answer.requests;
		} catch {
			// An unavailable native bridge or a temporary connection failure keeps the last view.
		} finally {
			reading = false;
		}
	}
	async function compare(item: DeviceApprovalRequest) {
		if (!active || comparing || busy) return;
		comparing = true;
		try {
			const answer = await request({ action: 'review', id: item.id });
			if (active && selected?.id === item.id && 'state' in answer && answer.state === 'compare')
				code = answer.code;
		} catch {
			if (active && selected?.id === item.id) error = 'Could not review this request.';
		} finally {
			comparing = false;
		}
	}
	function review(item: DeviceApprovalRequest) {
		selected = item;
		notice = '';
		error = '';
		code = '';
		void compare(item);
	}
	function close() {
		if (busy) return;
		selected = undefined;
		error = '';
	}
	async function decide(
		item: DeviceApprovalRequest,
		action: 'approve' | 'deny',
		event: MouseEvent
	) {
		if (busy || (action === 'approve' && !code)) return;
		busy = true;
		turn++;
		error = '';
		notice = '';
		try {
			const answer = await request(
				action === 'approve' ? { action, id: item.id, code } : { action, id: item.id },
				event
			);
			if (!active) return;
			if (!('state' in answer) || answer.state !== (action === 'approve' ? 'approved' : 'denied')) {
				error = 'Could not complete this decision. Try again.';
				return;
			}
			notice = action === 'approve' ? 'Device approved.' : 'Device denied.';
			requests = requests.filter(({ id }) => id !== item.id);
			selected = undefined;
		} catch {
			if (active) error = 'Could not complete this decision. Try again.';
		} finally {
			busy = false;
		}
	}
	onMount(() => {
		active = true;
		reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
		void refresh();
		const listTimer = setInterval(() => void refresh(), 15_000);
		const reviewTimer = setInterval(() => {
			if (selected && !code && !error) void compare(selected);
		}, 1500);
		return () => {
			active = false;
			clearInterval(listTimer);
			clearInterval(reviewTimer);
		};
	});
</script>

<svelte:window onfocus={() => void refresh()} />
{#if requests.length || notice || error}
	<hx-div class="device-approvals">
		{#if notice}<hx-p role="status">{notice}</hx-p>{/if}
		{#if error && !selected}<hx-p class="error" role="alert">{error}</hx-p>{/if}
		{#if requests.length}
			<hx-section aria-label="Device approvals" data-harness-component="device-approval-inbox">
				<hx-ul class="approval-list">
					{#each requests as item (item.id)}
						<hx-li class="approval-row" out:slide|global={{ duration: reducedMotion ? 0 : 280 }}>
							<Card label={device(item)}>
								<hx-strong>{device(item)}</hx-strong>
								<hx-small>{details(item)}</hx-small>
								<hx-div class="approval-actions">
									<hx-button
										type="button"
										disabled={busy}
										aria-label={'Review ' + device(item)}
										onclick={() => review(item)}>Review</hx-button
									>
									<hx-button
										type="button"
										disabled={busy}
										aria-label={'Deny ' + device(item)}
										onclick={(event) => void decide(item, 'deny', event)}>Deny</hx-button
									>
								</hx-div>
							</Card>
						</hx-li>
					{/each}
				</hx-ul>
			</hx-section>
		{/if}
	</hx-div>
{/if}
{#if selected}
	{@const item = selected}
	<Modal open title={'Approve ' + device(item)} variant="text" onClose={close}>
		<hx-div class="approval-detail">
			<hx-p>{details(item)}</hx-p>
			{#if code}
				<hx-p>Approve only if this code matches the code on the new device.</hx-p>
				<hx-strong class="approval-code">{code}</hx-strong>
			{:else if !error}
				<hx-p role="status">Waiting for the new device to show its code…</hx-p>
			{/if}
			{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
			<hx-div class="approval-actions">
				<hx-button
					type="button"
					class="primary"
					disabled={busy || !code}
					onclick={(event) => void decide(item, 'approve', event)}
					>{busy ? 'Approving…' : 'Approve device'}</hx-button
				>
				<hx-button type="button" disabled={busy} onclick={close}>Cancel</hx-button>
			</hx-div>
		</hx-div>
	</Modal>
{/if}

<style>
	.device-approvals {
		display: grid;
		gap: var(--hx-space-12);
		max-width: 760px;
		margin: var(--hx-space-16) auto;
		padding: 0 var(--hx-space-16);
	}
	.approval-list,
	.approval-detail {
		display: grid;
		gap: var(--hx-space-12);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.approval-row :global(article) {
		display: grid;
		gap: var(--hx-space-8);
		padding: var(--hx-space-16);
		border: 1px solid var(--hx-color-border);
		border-radius: var(--hx-radius-large);
		background: var(--hx-color-surface-raised);
	}
	.approval-actions {
		display: flex;
		gap: var(--hx-space-8);
	}
	.approval-actions :global(button) {
		min-height: 44px;
	}
	.approval-code {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.12em;
	}
</style>
