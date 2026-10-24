<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Invitation } from 'collaboration';
	import { browserContext } from '../../../utils/development-tooling/browserContext';
	import { invitationLink } from './browserProjects';
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
			const input = {
				email: email.trim(),
				role: role === 'viewer' ? 'viewer' : role === 'writer' ? 'writer' : 'commenter'
			};
			invitation = await projects.invite(
				projectId,
				input as { email: string; role: 'viewer' | 'commenter' | 'writer' }
			);
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

<hx-section class="hub-card">
	<hx-h2>Invite someone</hx-h2>
	<hx-form
		class="hub-form"
		onsubmit={(event) => {
			event.preventDefault();
			void invite();
		}}
	>
		<hx-label
			>Email<hx-input type="email" bind:value={email} required autocomplete="off" /></hx-label
		><hx-label
			>Role<Select label="Role" bind:value={role}
				><hx-option value="writer">Write · read, comment and ask AI</hx-option><hx-option
					value="commenter">Comment · read and leave comments</hx-option
				><hx-option value="viewer">Read · browse only</hx-option></Select
			></hx-label
		>
		<hx-button class="primary" disabled={saving || !email.trim()}>Create invitation</hx-button>
		{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
	</hx-form>
	{#if invitation}<hx-div class="hub-form invitation-result">
			<hx-p>
				Harness sends no email. Give the link and the code to the person yourself, by separate ways.
				The code is shown only now and works once, until {new Date(
					invitation.expiresAt
				).toLocaleString()}, for the Google account with this email address.
			</hx-p>
			<hx-div class="copy-row">
				<hx-label>Invitation link<hx-input readonly value={link} /></hx-label><hx-button
					type="button"
					onclick={() => void copy('Link', link)}>Copy link</hx-button
				>
			</hx-div>
			<hx-div class="copy-row">
				<hx-label>Invitation code<hx-input readonly value={invitation.code} /></hx-label><hx-button
					type="button"
					onclick={() => void copy('Code', invitation?.code ?? '')}>Copy code</hx-button
				>
			</hx-div>
			{#if copied}<hx-p class="muted" role="status">{copied}</hx-p>{/if}
		</hx-div>{/if}
</hx-section>
