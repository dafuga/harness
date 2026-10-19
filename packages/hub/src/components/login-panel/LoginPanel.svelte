<script lang="ts">
	import { browserContext } from "../../utils/browserContext";
	import { googleButton } from "./googleButton";
	import EmailProofPanel from '../EmailProofPanel.svelte';
	let {
		reason = 'Sign in with your Google account to open the projects you were invited to.'
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

<section class="hub-card login-panel">
	{#if !status}<p class="muted" role={session.error ? 'alert' : undefined}>
			{session.error || 'Checking sign-in…'}
		</p>{:else if !status.configured}<h2>Sign-in is not configured</h2>
		<p>
			Google sign-in is not configured for this deployment. An administrator sets a Google client ID
			and a session secret; until then nobody can sign in and no project is shown.
		</p>{:else if proof}<EmailProofPanel {proof} />{:else}<h2>Sign in to Harness</h2>
		<p>{reason}</p>
		<div class="google-button" bind:this={holder}></div>
		{#if failure || session.error}<p class="error" role="alert">
				{failure || session.error}
			</p>{/if}{/if}
</section>
