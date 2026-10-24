<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { timeLabel } from '$desktop/utils/timeLabel';
	import type { EmailProofStatus } from '../../models/accounts-access/HubAuth.types';
	import { EMAIL_CODE_LENGTH } from '../../models/accounts-access/HubAuth.types';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	let { proof }: { proof: EmailProofStatus } = $props();
	const { session } = browserContext();
	let code = $state('');
	const complete = $derived(new RegExp(`^[0-9]{${EMAIL_CODE_LENGTH}}$`).test(code));
	/**
	 * The code is typed here and sent in a body; it is kept nowhere else. Whether anyone is
	 * signed in afterwards is what the server then says, not what this form assumes.
	 */
	async function verify() {
		if (!complete || session.busy) return;
		if (await session.verifyEmail(code)) code = '';
	}
	async function cancel() {
		code = '';
		await session.signOut();
	}
</script>

<hx-h2>Confirm your email address</hx-h2>
<hx-p>
	Confirm <hx-strong>{proof.email}</hx-strong> belongs to you to finish signing in. Choose Send code
	to receive an {EMAIL_CODE_LENGTH}-digit verification code.
</hx-p>
{#if proof.sent}<hx-p role="status">
		A code was sent to {proof.email}.{proof.expiresAt
			? ` It works until ${timeLabel(proof.expiresAt)}.`
			: ''}
	</hx-p>{/if}
<hx-form
	class="hub-form email-proof"
	onsubmit={(event) => {
		event.preventDefault();
		void verify();
	}}
>
	<hx-button type="button" disabled={session.busy} onclick={() => void session.sendEmailCode()}
		>{proof.sent ? 'Resend code' : 'Send code'}</hx-button
	>
	<hx-label
		>{EMAIL_CODE_LENGTH}-digit code<hx-input
			bind:value={code}
			inputmode="numeric"
			autocomplete="one-time-code"
			maxlength={EMAIL_CODE_LENGTH}
			pattern={`[0-9]{${EMAIL_CODE_LENGTH}}`}
			spellcheck="false"
			disabled={!proof.sent}
		/></hx-label
	>
	<hx-div class="row">
		<hx-button class="primary" disabled={!complete || session.busy}>Verify</hx-button><hx-button
			type="button"
			disabled={session.busy}
			onclick={() => void cancel()}>Cancel</hx-button
		>
	</hx-div>
	{#if session.error}<hx-p class="error" role="alert">{session.error}</hx-p>{/if}
</hx-form>
