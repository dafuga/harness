<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_xa7iq7huqp -->
<script lang="ts">
	import DetailList from '$shared/shared-primitives/DetailList.svelte';
	import Modal from '$shared/Modal.svelte';
	import type {
		ApprovalCards,
		ApprovalDecision
	} from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';

	let {
		card,
		status,
		disabled,
		canStart = false,
		error,
		decide,
		close
	}: {
		card: ApprovalCards[number];
		status: string;
		disabled: boolean;
		canStart?: boolean;
		error: string;
		decide: (decision: ApprovalDecision['decision']) => void;
		close: () => void;
	} = $props();
	let actionLabel = $derived(card.action === 'signoff' ? 'sign-off' : card.action);
	let progress = $derived(card.progress);
	let fields = $derived([
		['Project', card.project],
		['Environment', card.environment],
		['Action', actionLabel],
		['Target', card.target],
		['Source revision', card.source],
		['Artifact SHA-256', card.artifact ?? 'Legacy version without a recorded artifact'],
		['Release ID', card.release],
		['Plan SHA-256', card.plan],
		['Run ID', card.control?.run],
		['Release being rolled back', card.control?.rollbackFrom],
		['Parity SHA-256', card.parity],
		['Allowed differences', String(card.allowedDifferences)],
		['Blocking parity differences', card.control?.preview?.fields.join(', ') || null],
		['Smoke script', card.smoke],
		['Manifest SHA-256', card.manifest],
		['Predecessor run', card.predecessor?.id],
		['Predecessor sign-off', card.predecessor?.signoff],
		['Predecessor smoke', card.predecessor?.smoke.join(', ')],
		['Reviewed smoke checks', card.control?.review?.checks.join(', ')],
		['Reviewer receipt', card.control?.review?.reference],
		['Rollback target', `${card.rollback.target} · ${card.rollback.version}`],
		['Rollback source', card.rollback.source],
		['Rollback artifact', card.rollback.artifact ?? 'Legacy version without a recorded artifact'],
		['Expires', new Date(card.expiresAt).toISOString()],
		['Decision', card.receipt ? (card.receipt.decision === 'allow' ? 'Allowed' : 'Denied') : null],
		['Decision receipt', card.receipt?.receipt],
		['Decided by', card.receipt?.actor],
		['Decided at', card.receipt ? new Date(card.receipt.decidedAt).toISOString() : null],
		['Go recorded at', card.goAt ? new Date(card.goAt).toISOString() : null],
		['Provider operation', progress && 'operation' in progress ? progress.operation : null],
		['Routed version', progress && 'version' in progress ? progress.version : null],
		['Passed smoke checks', progress && 'checks' in progress ? progress.checks.join(', ') : null],
		['Recorded sign-off', progress && 'reference' in progress ? progress.reference : null]
	]);
</script>

<Modal open title="Review deploy approval" variant="text" onClose={close}>
	<DetailList
		rows={fields.filter((row) => row[1] != null)}
		rowKey={(row) => row[0] ?? ''}
		className="deploy-approval-fields"
		grouped={false}
	>
		{#snippet label(row: Array<string | null | undefined>)}{row[0]}{/snippet}
		{#snippet children(row: Array<string | null | undefined>)}{row[1]}{/snippet}
	</DetailList>
	{#snippet footer()}
		<hx-div class="decision-actions">
			<hx-p role="status">{status}</hx-p>
			{#if error}<hx-p role="alert">{error}</hx-p>{/if}
			{#if !card.receipt && !card.progress && !card.control?.preview && status !== 'Expired'}
				<hx-button type="button" {disabled} onclick={() => decide('deny')}>Deny</hx-button>
				<hx-button type="button" class="primary" {disabled} onclick={() => decide('allow')}
					>Allow {actionLabel}</hx-button
				>
			{/if}
			{#if canStart}
				<hx-button type="button" class="primary" {disabled} onclick={() => decide('go')}>
					{card.action === 'signoff' ? 'Record sign-off' : `Start ${actionLabel}`}
				</hx-button>
			{/if}
		</hx-div>
	{/snippet}
</Modal>

<style>
	:global(.viewer-dialog[open]:has(.deploy-approval-fields)) {
		display: flex;
		flex-direction: column;
	}
	:global(.viewer-dialog:has(.deploy-approval-fields) .viewer-content) {
		min-height: 0;
		overflow: auto;
	}
	:global(.viewer-dialog:has(.deploy-approval-fields) > footer) {
		flex: none;
	}
	:global(.deploy-approval-fields) {
		display: grid;
		grid-template-columns: minmax(6rem, 1fr) minmax(0, 3fr);
		gap: var(--hx-space-8) var(--hx-space-12);
		margin: 0;
	}
	:global(.deploy-approval-fields dt) {
		color: var(--hx-color-text-muted);
	}
	:global(.deploy-approval-fields dd) {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.decision-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: var(--hx-space-8);
		padding: var(--hx-space-12) var(--hx-space-16);
	}
	p {
		margin: 0 auto 0 0;
	}
	button {
		min-height: 44px;
	}
</style>
