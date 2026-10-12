<script lang="ts">
	import type { DesignVersion, EntityDetail } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let {
		entity,
		workspace,
		design,
		approved
	}: { entity: EntityDetail; workspace: Workspace; design: DesignVersion; approved: boolean } =
		$props();
	let approving = $state(false);
	let error = $state('');
	const imageless = $derived(
		['pages', 'components'].includes(entity.category) && !design.images.length
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
				imageHashes: design.images.map((image) => image.sha256),
				contractHash: entity.contract.hash,
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

{#if error}<p class="error" role="alert">{error}</p>{/if}<button
	class="primary approve"
	disabled={blocked}
	onclick={() => void approve()}
	>{approved ? 'Design ' + design.version + ' approved' : 'Approve ' + design.version}</button
><small class="approval-note"
	>Approval saves the exact design. Code starts with a Change request.</small
>
