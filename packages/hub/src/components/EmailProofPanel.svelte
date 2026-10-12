<script lang="ts">
	import { timeLabel } from '$desktop/utils/timeLabel';
	import type { EmailProofStatus } from '../models/HubAuth.types';
	import { EMAIL_CODE_LENGTH } from '../models/HubAuth.types';
	import { browserContext } from '../utils/browserContext';
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

<h2>Confirm your email address</h2>
<p>
	Confirm <strong>{proof.email}</strong> belongs to you to finish signing in. Choose Send code to
	receive an {EMAIL_CODE_LENGTH}-digit verification code.
</p>
{#if proof.sent}<p role="status">
		A code was sent to {proof.email}.{proof.expiresAt
			? ` It works until ${timeLabel(proof.expiresAt)}.`
			: ''}
	</p>{/if}
<form
	class="hub-form email-proof"
	onsubmit={(event) => {
		event.preventDefault();
		void verify();
	}}
>
	<button type="button" disabled={session.busy} onclick={() => void session.sendEmailCode()}
		>{proof.sent ? 'Resend code' : 'Send code'}</button
	>
	<label
		>{EMAIL_CODE_LENGTH}-digit code<input
			bind:value={code}
			inputmode="numeric"
			autocomplete="one-time-code"
			maxlength={EMAIL_CODE_LENGTH}
			pattern={`[0-9]{${EMAIL_CODE_LENGTH}}`}
			spellcheck="false"
			disabled={!proof.sent}
		/></label
	>
	<div class="row">
		<button class="primary" disabled={!complete || session.busy}>Verify</button><button
			type="button"
			disabled={session.busy}
			onclick={() => void cancel()}>Cancel</button
		>
	</div>
	{#if session.error}<p class="error" role="alert">{session.error}</p>{/if}
</form>
