<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Invitation } from 'collaboration';
	import { browserContext } from '../utils/browserContext';
	import { invitationLink } from '../utils/browserProjects';
	let { projectId }: { projectId: string } = $props();
	const { projects } = browserContext();
	let email = $state('');
	let role = $state('commenter');
	let invitation = $state<Invitation | null>(null);
	let error = $state('');
	let copied = $state('');
	let saving = $state(false);
	const link = $derived(invitation ? invitationLink(location.origin, invitation) : '');
	async function invite() {
		if (saving || !email.trim()) return;
		saving = true;
		error = '';
		copied = '';
		try {
			const input = { email: email.trim(), role: role === 'viewer' ? 'viewer' : 'commenter' };
			invitation = await projects.invite(projectId, input as { email: string; role: 'viewer' });
		} catch (cause) {
			invitation = null;
			error = String(cause);
		} finally {
			saving = false;
		}
	}
	async function copy(what: string, value: string) {
		try {
			await navigator.clipboard.writeText(value);
			copied = `${what} copied.`;
		} catch {
			copied = `Select the ${what.toLowerCase()} and copy it yourself.`;
		}
	}
</script>

<section class="hub-card">
	<h2>Invite someone</h2>
	<form
		class="hub-form"
		onsubmit={(event) => {
			event.preventDefault();
			void invite();
		}}
	>
		<label>Email<input type="email" bind:value={email} required autocomplete="off" /></label><label
			>Role<Select label="Role" bind:value={role}
				><option value="commenter">Commenter · reads and comments</option><option value="viewer"
					>Viewer · reads only</option
				></Select
			></label
		>
		<button class="primary" disabled={saving || !email.trim()}>Create invitation</button>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</form>
	{#if invitation}<div class="hub-form invitation-result">
			<p>
				Harness sends no email. Give the link and the code to the person yourself, by separate ways.
				The code is shown only now and works once, until {new Date(
					invitation.expiresAt
				).toLocaleString()}, for the Google account with this email address.
			</p>
			<div class="copy-row">
				<label>Invitation link<input readonly value={link} /></label><button
					type="button"
					onclick={() => void copy('Link', link)}>Copy link</button
				>
			</div>
			<div class="copy-row">
				<label>Invitation code<input readonly value={invitation.code} /></label><button
					type="button"
					onclick={() => void copy('Code', invitation?.code ?? '')}>Copy code</button
				>
			</div>
			{#if copied}<p class="muted" role="status">{copied}</p>{/if}
		</div>{/if}
</section>
