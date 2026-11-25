<!-- @harness-tier page -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_wx4uxnb4uh -->
<!-- @harness-view overview -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { getContext, onMount } from 'svelte';
	import {
		approvalCards,
		approvalReceipt,
		goReceipt
	} from '../../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox';
	import type {
		ApprovalCards,
		ApprovalDecision
	} from '../../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';
	import { nativeAccountContext } from '../../../models/development-tooling/Environment.types';
	import type { NativeAccountContext } from '../../../models/development-tooling/Environment.types';
	import DeployApprovalCard from '../../../components/development-tooling/DeployApprovalCard.svelte';
	import { ProjectSyncService } from '../../../services/projects-sessions/ProjectSyncService';

	const account = getContext<NativeAccountContext>(nativeAccountContext);
	const bridge = account.environment?.bridge;
	let cards = $state.raw<ApprovalCards>([]);
	let selectedId = $state<string>();
	let selected = $derived(cards.find((card) => card.id === selectedId));
	let now = $state(Date.now());
	let available = $state(false);
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');
	let read = 0;
	let active = true;
	async function refresh() {
		const turn = ++read;
		loading = true;
		try {
			const result = approvalCards.parse(await bridge?.deployApprovals?.());
			if (turn !== read) return;
			cards = result;
			available = true;
		} catch {
			if (turn !== read) return;
			cards = [];
			selectedId = undefined;
			available = false;
		} finally {
			if (turn === read) loading = false;
		}
	}
	const sync = new ProjectSyncService({ refresh, interval: 10_000 });

	onMount(() => {
		void refresh();
		sync.start();
		const timer = setInterval(() => (now = Date.now()), 1000);
		const release = bridge?.onCacheStatus?.(({ status }) => {
			if (status === 'denied') {
				cards = [];
				selectedId = undefined;
				void sync.sync();
			}
		});
		return () => {
			active = false;
			read++;
			clearInterval(timer);
			sync.stop();
			release?.();
		};
	});

	async function record(decision: ApprovalDecision['decision']) {
		const card = selected;
		if (
			!card ||
			card.expiresAt <= Date.now() ||
			loading ||
			busy ||
			card.progress ||
			card.control?.preview
		)
			return;
		if (decision === 'go' ? !canGo(card) : card.receipt) return;
		busy = true;
		error = '';
		try {
			const reply = await bridge?.deployApprovals?.({ id: card.id, plan: card.plan, decision });
			const match = (answer: { id: string; plan: string }) =>
				answer.id === card.id && answer.plan === card.plan;
			const patch =
				decision === 'go'
					? { goAt: goReceipt.refine(match).parse(reply).goAt }
					: {
							receipt: approvalReceipt
								.refine((answer) => match(answer) && answer.decision === decision)
								.parse(reply)
						};
			if (active) cards = cards.map((item) => (item.id === card.id ? { ...item, ...patch } : item));
		} catch {
			if (active)
				error = 'Could not confirm the action. Check the refreshed request before trying again.';
		} finally {
			if (active) {
				await sync.sync();
				busy = false;
			}
		}
	}
	function canGo(card: ApprovalCards[number]) {
		if (!card.control || card.control.preview || card.progress) return false;
		return card.receipt?.decision === 'allow' && !card.goAt && !card.used && card.expiresAt > now;
	}
	const phases = {
		stopped: 'Stopped before execution',
		applying: 'Waiting for provider receipt',
		'not-applied': 'Provider confirmed no change',
		deployed: 'Provider confirmed route',
		verified: 'Route smoke passed',
		complete: 'Complete',
		'cleanup-failed': 'Cleanup needs reconciliation',
		'signed-off': 'Sign-off recorded'
	};

	function status(card: ApprovalCards[number]) {
		const preview = card.control?.preview;
		if (preview) return preview.blocked ? 'Plan blocked by parity' : 'Read-only plan';
		if (card.receipt?.decision === 'deny') return 'Denied';
		if (card.progress) return phases[card.progress.phase];
		const expired = card.expiresAt <= now;
		if (card.used) return card.goAt ? goClaimStatus(expired) : 'Claimed by runner';
		if (expired) return 'Expired';
		if (card.goAt) return 'Go recorded';
		return card.receipt ? 'Allowed' : 'Pending';
	}
	function goClaimStatus(expired: boolean) {
		return expired ? 'Outcome needs reconciliation' : 'Runner checking prerequisites';
	}
</script>

<svelte:head><title>Deploy approvals · Harness</title></svelte:head>

<hx-main class="approval-page" aria-labelledby="deploy-approvals-title">
	<hx-header>
		<hx-a href={resolve('/')}>Harness home</hx-a>
		<hx-h1 id="deploy-approvals-title">Deploy approvals</hx-h1>
	</hx-header>
	{#if error}<hx-p role="alert">{error}</hx-p>{/if}
	<hx-section aria-label="Release decisions" aria-busy={loading}>
		{#each cards as card (card.id)}
			<hx-button
				class="release-row"
				type="button"
				aria-label={`Review ${card.project} ${card.environment} ${card.action}`}
				aria-haspopup="dialog"
				onclick={() => {
					error = '';
					selectedId = card.id;
				}}
			>
				<hx-strong>{card.project}</hx-strong>
				<hx-small
					>{card.environment} · {card.action === 'signoff' ? 'sign-off' : card.action} · {status(
						card
					)}</hx-small
				>
			</hx-button>
		{:else}
			<hx-p class="muted" role="status">
				{loading
					? 'Checking deploy approvals…'
					: available
						? 'No deploy approval requests.'
						: 'Deploy approvals are unavailable.'}
			</hx-p>
		{/each}
	</hx-section>
</hx-main>

{#if selected}
	<DeployApprovalCard
		card={selected}
		status={status(selected)}
		disabled={loading || busy || selected.expiresAt <= now}
		canStart={canGo(selected)}
		decide={record}
		close={() => (selectedId = undefined)}
		{error}
	/>
{/if}

<style>
	.approval-page {
		box-sizing: border-box;
		width: min(100%, 640px);
		margin: 0 auto;
		padding: var(--hx-space-28) var(--hx-space-24) var(--hx-space-40);
	}
	h1 {
		margin: var(--hx-space-12) 0 var(--hx-space-20);
	}
	.release-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 44px;
		gap: var(--hx-space-8);
		border: 0;
		border-bottom: 1px solid var(--hx-color-border);
		border-radius: 0;
		text-align: start;
		overflow-wrap: anywhere;
	}
	.release-row small {
		color: var(--hx-color-text-muted);
	}
</style>
