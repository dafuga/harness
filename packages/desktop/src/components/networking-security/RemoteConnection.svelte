<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_sk3d6plj6h -->
<script lang="ts">
	import { getContext } from 'svelte';
	import type { RemoteHost } from '../../lib/stores/networking-security/remoteHost.svelte';
	import type { RemotePhone } from '../../lib/stores/networking-security/remotePhone.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { remoteContext } from '../../models/development-tooling/Environment.types';
	import RemoteHostPanel from './remote-host-panel/RemoteHostPanel.svelte';
	import RemotePhonePanel from './remote-phone-panel/RemotePhonePanel.svelte';
	let { workspace, compact = false }: { workspace: Workspace; compact?: boolean } = $props();
	/**
	 * The environment decides which side this is: a desktop sets up phone access, a phone connects
	 * to a computer. A host app without either, such as a hosted page, renders nothing here.
	 */
	const stores = getContext<{ host: RemoteHost; phone: RemotePhone } | undefined>(remoteContext);
	let vaultIssue = $state('');
	const openVault = async () => {
		vaultIssue = '';
		try {
			await workspace.remote.phone?.openVault?.();
		} catch (error) {
			vaultIssue = error instanceof Error ? error.message : 'The Vault could not open.';
		}
	};
</script>

{#if stores && workspace.remote.host}<RemoteHostPanel
		store={stores.host}
		{compact}
	/>{:else if stores && workspace.remote.phone}<RemotePhonePanel
		store={stores.phone}
		{compact}
	/>{#if workspace.remote.phone.openVault}<button type="button" class="vault" onclick={openVault}
			>Vault</button
		>{#if vaultIssue}<span class="vault-issue" role="alert">{vaultIssue}</span>{/if}{/if}{/if}

<style>
	.vault {
		min-height: 44px;
		min-width: 44px;
		padding: 0 var(--hx-space-12);
		border: 1px solid var(--hx-color-border);
		border-radius: var(--hx-radius);
		background: var(--hx-color-surface);
		color: var(--hx-color-text);
		font: inherit;
		cursor: pointer;
	}
	.vault-issue {
		color: var(--hx-muted);
	}
</style>
