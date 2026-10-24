<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
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
</script>

{#if stores && workspace.remote.host}<RemoteHostPanel
		store={stores.host}
		{compact}
	/>{:else if stores && workspace.remote.phone}<RemotePhonePanel
		store={stores.phone}
		{compact}
	/>{/if}
