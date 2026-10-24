<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { browserAuth } from '../../../utils/accounts-access/browserAuth';
	import { browserContext } from '../../../utils/development-tooling/browserContext';
	import { nativeScope } from './nativeScope';
	let { handoffId }: { handoffId: string } = $props();
	const { api, projects, session } = browserContext();
	const auth = browserAuth(api);
	let request = $state<'reading' | 'pending' | 'approved' | 'expired'>('reading');
	let scope = $state('');
	let code = $state('');
	let error = $state('');
	let busy = $state(false);
	let done = $state(false);
	/** Inside a frame a person cannot see what they approve, so nothing is offered there. */
	const framed = window.top !== window.self;
	/** What is asked for is read and named before anything can be approved. */
	onMount(async () => {
		try {
			const asked = await auth.nativeRequest(handoffId);
			scope = await nativeScope(asked.resource, projects);
			request = asked.status;
		} catch (cause) {
			scope = await nativeScope(null, projects);
			error = String(cause);
			request = 'pending';
		}
	});
	/** The code is typed here and sent in a body. It is never part of an address. */
	async function approve() {
		if (busy || !code.trim()) return;
		busy = true;
		error = '';
		try {
			await auth.nativeApprove(handoffId, code.trim().toUpperCase());
			done = true;
			code = '';
		} catch (cause) {
			error = String(cause);
		} finally {
			busy = false;
		}
	}
</script>

<hx-section class="hub-card">
	{#if framed}<hx-p>Open this page in its own browser tab to approve a device.</hx-p>
	{:else if done}<hx-h2>Approved</hx-h2>
		<hx-p role="status">
			Return to your Harness device; it connects within a few seconds. Signing out here also
			disconnects it.
		</hx-p>{:else if request === 'reading'}<hx-p class="muted">Reading the request…</hx-p>
	{:else if request === 'expired'}<hx-h2>This request has expired</hx-h2>
		<hx-p>Start again on your Harness device to get a new code.</hx-p>
	{:else if request === 'approved'}<hx-h2>This request was already approved</hx-h2>
		<hx-p>Nothing more is needed here.</hx-p>
	{:else}<hx-h2>A Harness device asks to connect</hx-h2>
		<hx-p>
			It asks to open <hx-strong>{scope}</hx-strong> as {session.actor?.email}. Your project role
			controls access: readers can view, commenters can also comment, and writers can ask agents to
			make changes.
		</hx-p>
		<hx-p>
			Approve only what you started yourself on your own Harness device just now. Never type a code
			that someone sent you.
		</hx-p>
		<hx-form
			class="hub-form"
			onsubmit={(event) => {
				event.preventDefault();
				void approve();
			}}
		>
			<hx-label
				>Code shown on your Harness device<hx-input
					bind:value={code}
					required
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
				/></hx-label
			>
			<hx-button class="primary" disabled={busy || !code.trim()}>Approve this device</hx-button>
			{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
		</hx-form>{/if}
</hx-section>
