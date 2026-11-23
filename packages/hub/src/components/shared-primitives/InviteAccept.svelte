<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_tpeglzwz3m -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	let { projectId, invitationId }: { projectId: string; invitationId: string } = $props();
	const { projects, session } = browserContext();
	let code = $state('');
	let error = $state('');
	let joining = $state(false);
	/** The code is typed here and sent in a body. It is never part of an address. */
	async function join() {
		if (joining || !code.trim()) return;
		joining = true;
		error = '';
		try {
			await projects.accept(projectId, invitationId, code.trim());
			location.assign(
				resolve('/projects/[projectId]/harness/[...path]', { projectId, path: 'pages' })
			);
		} catch (cause) {
			error = String(cause);
			joining = false;
		}
	}
</script>

<hx-section class="hub-card gate-card">
	<hx-p class="muted">
		Signed in as {session.actor?.email}. The invitation works once, for the Google account it was
		made for.
	</hx-p>
	<hx-form
		class="hub-form"
		onsubmit={(event) => {
			event.preventDefault();
			void join();
		}}
	>
		<hx-label
			>Invitation code<hx-input
				class="code-field"
				bind:value={code}
				required
				autocomplete="one-time-code"
				spellcheck="false"
			/></hx-label
		>
		<hx-button class="primary" disabled={joining || !code.trim()}>Join project</hx-button>
		{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
	</hx-form>
</hx-section>
