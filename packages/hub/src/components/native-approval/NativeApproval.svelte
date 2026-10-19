<script lang="ts">
	import { onMount } from 'svelte';
	import { browserAuth } from '../../utils/browserAuth';
	import { browserContext } from '../../utils/browserContext';
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

<section class="hub-card">
	{#if framed}<p>Open this page in its own browser tab to approve a device.</p>
	{:else if done}<h2>Approved</h2>
		<p role="status">
			Return to your Harness device; it connects within a few seconds. Signing out here also
			disconnects it.
		</p>{:else if request === 'reading'}<p class="muted">Reading the request…</p>
	{:else if request === 'expired'}<h2>This request has expired</h2>
		<p>Start again on your Harness device to get a new code.</p>
	{:else if request === 'approved'}<h2>This request was already approved</h2>
		<p>Nothing more is needed here.</p>
	{:else}<h2>A Harness device asks to connect</h2>
		<p>
			It asks to open <strong>{scope}</strong> as {session.actor?.email}. Your project role controls
			access: readers can view, commenters can also comment, and writers can ask agents to make
			changes.
		</p>
		<p>
			Approve only what you started yourself on your own Harness device just now. Never type a code
			that someone sent you.
		</p>
		<form
			class="hub-form"
			onsubmit={(event) => {
				event.preventDefault();
				void approve();
			}}
		>
			<label
				>Code shown on your Harness device<input
					bind:value={code}
					required
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
				/></label
			>
			<button class="primary" disabled={busy || !code.trim()}>Approve this device</button>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</form>{/if}
</section>
