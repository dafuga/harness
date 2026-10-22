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

<section class="hub-card">
	<h2>Enter your invitation code</h2>
	<p>
		Signed in as {session.actor?.email}. The invitation works for the Google account it was made
		for, once.
	</p>
	<form
		class="hub-form"
		onsubmit={(event) => {
			event.preventDefault();
			void join();
		}}
	>
		<label
			>Invitation code<input
				bind:value={code}
				required
				autocomplete="off"
				spellcheck="false"
			/></label
		>
		<button class="primary" disabled={joining || !code.trim()}>Join project</button>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</form>
</section>
