<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { browserContext } from '../../../utils/development-tooling/browserContext';
	import { googleButton } from './googleButton';
	import EmailProofPanel from '../../verification-evidence/EmailProofPanel.svelte';
	let {
		reason = 'Sign in with Google to open the projects you own and the ones you were invited to.'
	}: { reason?: string } = $props();
	const { session } = browserContext();
	let holder = $state<HTMLDivElement>();
	let failure = $state('');
	const status = $derived(session.status);
	/** While an address waits for its code there is no Google button: the person finishes or cancels. */
	const proof = $derived(session.emailProof);
	/**
	 * Every rendering of the button has its own challenge: the nonce goes to Google, the CSRF
	 * value returns with the credential. Where sign-in is not configured nothing is loaded.
	 */
	$effect(() => {
		const clientId = status?.configured && !status.actor && !proof ? status.clientId : null;
		const element = holder;
		if (!clientId || !element) return;
		let stale = false;
		const credential = (value: string, csrf: string) => void session.signIn(value, csrf);
		void session
			.challenge()
			.then(({ nonce, csrf }) =>
				stale
					? undefined
					: googleButton(element, {
							clientId,
							nonce,
							credential: (value) => credential(value, csrf)
						})
			)
			.catch((cause: unknown) => {
				if (!stale) failure = String(cause);
			});
		return () => {
			stale = true;
		};
	});
</script>

<hx-section class="hub-card login-panel">
	{#if !status}<hx-p class="muted" role={session.error ? 'alert' : undefined}>
			{session.error || 'Checking sign-in…'}
		</hx-p>{:else if !status.configured}<hx-h2>Sign-in is not configured</hx-h2>
		<hx-p>
			Google sign-in is not configured for this deployment. An administrator sets a Google client ID
			and a session secret; until then nobody can sign in and no project is shown.
		</hx-p>{:else if proof}<EmailProofPanel {proof} />{:else}<hx-h2>Sign in to Harness</hx-h2>
		<hx-p>{reason}</hx-p>
		<hx-p class="muted">
			One Google account keeps the same projects on every device where you sign in, and new ones
			appear without reloading.
		</hx-p>
		<hx-div class="google-button" bind:this={holder}></hx-div>
		{#if failure || session.error}<hx-p class="error" role="alert">
				{failure || session.error}
			</hx-p>{/if}{/if}
</hx-section>
