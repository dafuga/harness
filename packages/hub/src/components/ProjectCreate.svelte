<script lang="ts">
	import Select from '$shared/Select.svelte';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { GithubRepositoryOption, GithubStatus } from '../models/HubAuth.types';
	import { browserContext } from '../utils/browserContext';
	let { created }: { created: (projectId: string) => void } = $props();
	const { projects } = browserContext();
	let github = $state<GithubStatus | null>(null);
	let repositories = $state<GithubRepositoryOption[]>([]);
	let truncated = $state(false);
	let repository = $state('');
	let name = $state('');
	let error = $state('');
	let saving = $state(false);
	onMount(() => void load());
	async function load() {
		try {
			github = await projects.github();
			if (!github.connected) return;
			const listed = await projects.repositories();
			repositories = listed.repositories;
			truncated = listed.truncated;
		} catch (cause) {
			error = String(cause);
		}
	}
	/** Only a repository the server listed can be chosen, and the server checks it again. */
	async function create() {
		if (saving || !repository || !name.trim()) return;
		saving = true;
		error = '';
		try {
			const project = await projects.create({
				name: name.trim(),
				repositoryId: Number(repository)
			});
			created(project.id);
		} catch (cause) {
			error = String(cause);
		} finally {
			saving = false;
		}
	}
</script>

<section class="hub-card">
	<h2>New shared project</h2>
	{#if !github}<p class="muted">{error || 'Checking the GitHub connection…'}</p>
	{:else if !github.configured}<p>
			The GitHub App is not configured for this deployment, so no project can be created here.
		</p>{:else if !github.connected}<p>
			A project shares one GitHub repository. Connect GitHub first. The server checks that you
			administer the repository; nothing typed on this page proves access.
		</p>
		<a
			class="outline gold"
			href={resolve('/api/[...path]', { path: 'github/connect' })}
			data-sveltekit-reload>Connect GitHub</a
		>{:else}<form
			class="hub-form"
			onsubmit={(event) => {
				event.preventDefault();
				void create();
			}}
		>
			<label
				>Repository<Select label="Repository" bind:value={repository} required
					><option value="">Choose a repository</option
					>{#each repositories as item (item.id)}<option value={String(item.id)}
							>{item.owner}/{item.name}</option
						>{/each}</Select
				></label
			><label>Project name<input bind:value={name} required maxlength="80" /></label>
			<button class="primary" disabled={saving || !repository || !name.trim()}
				>Create project</button
			>
			<small
				>Connected as {github.login}. The server checks again that you administer the repository.{truncated
					? ' Only the first repositories are listed.'
					: ''}</small
			>{#if error}<p class="error" role="alert">{error}</p>{/if}
		</form>{/if}
</section>
