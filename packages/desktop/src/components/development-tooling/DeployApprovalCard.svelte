<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_xa7iq7huqp -->
<script lang="ts">
	import Modal from '$shared/Modal.svelte';
	import type {
		ApprovalCards,
		ApprovalDecision
	} from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';

	let {
		card,
		status,
		disabled,
		error,
		decide,
		close
	}: {
		card: ApprovalCards[number];
		status: string;
		disabled: boolean;
		error: string;
		decide: (decision: ApprovalDecision['decision']) => void;
		close: () => void;
	} = $props();
	let fields = $derived([
		['Project', card.project],
		['Environment', card.environment],
		['Action', card.action],
		['Target', card.target],
		['Source revision', card.source],
		['Artifact SHA-256', card.artifact ?? 'Legacy version without a recorded artifact'],
		['Release ID', card.release],
		['Plan SHA-256', card.plan],
		['Parity SHA-256', card.parity],
		['Allowed differences', String(card.allowedDifferences)],
		['Smoke script', card.smoke],
		['Manifest SHA-256', card.manifest],
		['Predecessor run', card.predecessor?.id],
		['Predecessor sign-off', card.predecessor?.signoff],
		['Predecessor smoke', card.predecessor?.smoke.join(', ')],
		['Rollback target', `${card.rollback.target} · ${card.rollback.version}`],
		['Rollback source', card.rollback.source],
		['Rollback artifact', card.rollback.artifact ?? 'Legacy version without a recorded artifact'],
		['Expires', new Date(card.expiresAt).toISOString()],
		['Decision', card.receipt ? (card.receipt.decision === 'allow' ? 'Allowed' : 'Denied') : null],
		['Decision receipt', card.receipt?.receipt],
		['Decided by', card.receipt?.actor],
		['Decided at', card.receipt ? new Date(card.receipt.decidedAt).toISOString() : null]
	]);
</script>

<Modal open title="Review deploy approval" variant="text" onClose={close}>
	<hx-dl data-deploy-approval-fields>
		{#each fields as [label, value] (label)}
			{#if value != null}<hx-dt>{label}</hx-dt><hx-dd>{value}</hx-dd>{/if}
		{/each}
	</hx-dl>
	{#snippet footer()}
		<hx-div class="decision-actions">
			<hx-p role="status">{status}</hx-p>
			{#if error}<hx-p role="alert">{error}</hx-p>{/if}
			{#if !card.receipt && status !== 'Expired'}
				<hx-button type="button" {disabled} onclick={() => decide('deny')}>Deny</hx-button>
				<hx-button type="button" class="primary" {disabled} onclick={() => decide('allow')}
					>Allow {card.action}</hx-button
				>
			{/if}
		</hx-div>
	{/snippet}
</Modal>

<style>
	:global(.viewer-dialog[open]:has([data-deploy-approval-fields])) {
		display: flex;
		flex-direction: column;
	}
	:global(.viewer-dialog:has([data-deploy-approval-fields]) .viewer-content) {
		min-height: 0;
		overflow: auto;
	}
	:global(.viewer-dialog:has([data-deploy-approval-fields]) > footer) {
		flex: none;
	}
	dl {
		display: grid;
		grid-template-columns: minmax(6rem, 1fr) minmax(0, 3fr);
		gap: var(--hx-space-8) var(--hx-space-12);
		margin: 0;
	}
	dt {
		color: var(--hx-color-text-muted);
	}
	dd {
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
