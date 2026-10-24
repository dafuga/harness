<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Select from '$shared/Select.svelte';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type {
		GithubRepositoryOption,
		GithubStatus
	} from '../../models/accounts-access/HubAuth.types';
	import { browserContext } from '../../utils/development-tooling/browserContext';
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

<hx-section class="hub-card">
	<hx-h2>New shared project</hx-h2>
	{#if !github}<hx-p class="muted">{error || 'Checking the GitHub connection…'}</hx-p>
	{:else if !github.configured}<hx-p>
			The GitHub App is not configured for this deployment, so no project can be created here.
		</hx-p>{:else if !github.connected}<hx-p>
			A project shares one GitHub repository. Connect GitHub first. The server checks that you
			administer the repository; nothing typed on this page proves access.
		</hx-p>
		<hx-a
			class="outline gold"
			href={resolve('/api/[...path]', { path: 'github/connect' })}
			data-sveltekit-reload>Connect GitHub</hx-a
		>{:else}<hx-form
			class="hub-form"
			onsubmit={(event) => {
				event.preventDefault();
				void create();
			}}
		>
			<hx-label
				>Repository<Select label="Repository" bind:value={repository} required
					><hx-option value="">Choose a repository</hx-option
					>{#each repositories as item (item.id)}<hx-option value={String(item.id)}
							>{item.owner}/{item.name}</hx-option
						>{/each}</Select
				></hx-label
			><hx-label>Project name<hx-input bind:value={name} required maxlength="80" /></hx-label>
			<hx-button class="primary" disabled={saving || !repository || !name.trim()}
				>Create project</hx-button
			>
			<hx-small
				>Connected as {github.login}. The server checks again that you administer the repository.{truncated
					? ' Only the first repositories are listed.'
					: ''}</hx-small
			>{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
		</hx-form>{/if}
</hx-section>
