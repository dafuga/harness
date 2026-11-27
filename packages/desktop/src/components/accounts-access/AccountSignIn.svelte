<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_2vrw624qcu -->
<script lang="ts">
	import { asset } from '$app/paths';
	import BrandMark from '$shared/shared-primitives/BrandMark.svelte';
	import type { NativeHostedStatus } from '../../models/projects-sessions/ProjectContext.types';
	import { hostedAddress } from '../../utils/networking-security/hostedAddress';

	let {
		status,
		error,
		busy,
		connect,
		cancel,
		retry
	}: {
		status?: NativeHostedStatus;
		error: string;
		busy: boolean;
		connect: (google: boolean) => void;
		cancel: () => void;
		retry: () => void;
	} = $props();
	const waiting = $derived(status?.state === 'pending');
	const code = $derived(waiting ? status?.handoff?.userCode : undefined);
	const address = $derived(hostedAddress(code ? status?.handoff?.verificationUrl : undefined));
</script>

<hx-main class="sign-in" data-harness-component="account-sign-in">
	<hx-section class="sign-in-inner" aria-label="Sign in to Harness">
		<hx-span class="sign-in-mark" role="img" aria-label="Harness"><BrandMark size={40} /></hx-span>
		{#if waiting}
			{#if code}
				<hx-p role="status">Enter this code on the Harness Hub.</hx-p>
				<hx-p class="code">{code}</hx-p>
				{#if address}<hx-p>{address}</hx-p>{/if}
			{:else}
				<hx-p class="waiting" role="status">Waiting for Google…</hx-p>
				<hx-p class="note">Finish signing in in your browser.</hx-p>
			{/if}
			<hx-button type="button" disabled={busy} onclick={cancel}>Cancel</hx-button>
		{:else if status?.configured}
			<hx-button
				type="button"
				class="sign-in-button"
				disabled={busy}
				aria-label="Sign in with Google"
				onclick={() => connect(true)}
			>
				<hx-img src={asset('/google-sign-in.svg')} alt="" />
			</hx-button>
			<hx-p class="note"
				>Opens Google in your browser. Use the same account on your phone and computer.</hx-p
			>
			<hx-button type="button" class="recovery" disabled={busy} onclick={() => connect(false)}>
				Use a one-time code
			</hx-button>
		{:else if error || status}
			{#if !error}<hx-p role="alert">Sign-in is unavailable for this build.</hx-p>{/if}
			<hx-button type="button" disabled={busy} onclick={retry}>Try again</hx-button>
		{:else}
			<hx-p role="status">Checking sign-in…</hx-p>
		{/if}
		{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
	</hx-section>
</hx-main>

<style>
	.sign-in-mark {
		color: var(--hx-color-primary);
	}
	.sign-in {
		min-height: 100dvh;
	}
	.sign-in-inner {
		display: grid;
		justify-items: center;
		gap: var(--hx-space-12);
		width: min(100%, 420px);
		margin: 0 auto;
		padding: 22vh var(--hx-space-24) var(--hx-space-40);
		text-align: center;
		overflow-wrap: anywhere;
	}
	.sign-in-button {
		border: 0;
		background: transparent;
		padding: 0;
	}
	.sign-in-button img {
		display: block;
	}
	.note,
	.recovery {
		margin: 0;
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
	}
	.recovery {
		border: 0;
		background: transparent;
	}
	.waiting,
	.error {
		margin: 0;
		padding: var(--hx-space-8) var(--hx-space-12);
		border-radius: var(--hx-radius-control);
	}
	.waiting {
		background: var(--hx-color-surface-raised);
	}
	.error {
		background: var(--hx-color-error-soft);
	}
	.code {
		font: var(--hx-type-size-heading) var(--hx-font-family-code);
	}
</style>
