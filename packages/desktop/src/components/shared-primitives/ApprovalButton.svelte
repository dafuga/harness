<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { DesignVersion, EntityDetail } from '../../models/development-tooling/Desktop.types';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { optionImages } from '../../utils/explorer-ui/threadAnchor';
	let {
		entity,
		workspace,
		design,
		approved,
		option = ''
	}: {
		entity: EntityDetail;
		workspace: Workspace;
		design: DesignVersion;
		approved: boolean;
		/** The design option shown; an approval binds it and its images, never another option. */
		option?: string;
	} = $props();
	const images = $derived(optionImages(design, option));
	let approving = $state(false);
	let error = $state('');
	/** What is approved: the plan of a function, the design of anything else. */
	const named = $derived(entity.category === 'functions' ? 'Plan' : 'Design');
	const imageless = $derived(
		['pages', 'layouts', 'components'].includes(entity.category) && !images.length
	);
	const blocked = $derived(
		!workspace.snapshot?.writable ||
			!entity.contract.hash ||
			imageless ||
			approved ||
			approving ||
			design.version !== entity.latestVersion
	);
	/** An approval names the exact images and contract. It saves a decision and runs nothing. */
	async function approve() {
		if (blocked || !entity.contract.hash) return;
		approving = true;
		error = '';
		try {
			await workspace.bridge!.approve({
				entityId: entity.id,
				version: design.version,
				imageHashes: images.map((image) => image.sha256),
				contractHash: entity.contract.hash,
				...(design.options?.length ? { option } : {}),
				...workspace.context
			});
			await workspace.refresh();
		} catch (cause) {
			error = String(cause);
		} finally {
			approving = false;
		}
	}
</script>

{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}<hx-button
	class="primary approve"
	disabled={blocked}
	onclick={() => void approve()}
	>{approved ? `${named} ${design.version} approved` : 'Approve ' + design.version}</hx-button
><hx-small class="approval-note"
	>Approval saves the exact {named.toLowerCase()}. Code starts with a Change request.</hx-small
>
