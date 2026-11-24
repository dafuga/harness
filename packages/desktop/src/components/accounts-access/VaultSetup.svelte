<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_qjyib7idol -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		VaultAction,
		VaultSetupBridge
	} from '../../../../../deploy/vault/setup/macInstaller.types';

	let bridge: VaultSetupBridge | undefined;
	let status = $state('unsupported');
	let action = $state<VaultAction | null>(null);
	let startingFresh = $state(false);
	let error = $state<string | null>(null);
	let removed = $state(false);
	const phase = $derived(status.split(':')[2] ?? '');
	const showSetup = $derived(status === 'absent' || (action === 'setup' && startingFresh));
	const notice = $derived(getNotice(status, phase, action));

	const steps: Record<string, string> = {
		dependencies: 'Checking installer prerequisites',
		identity: 'Checking the Vault ownership journal',
		group: 'Updating the dedicated Vault group',
		account: 'Updating the dedicated Vault account',
		permissions: 'Verifying account isolation',
		home: 'Preparing the private Vault data directory',
		engine: 'Starting the private Docker engine',
		verification: 'Verifying the private Docker engine',
		processes: 'Waiting for the executor to stop',
		archive: 'Preserving private Vault data'
	};

	function getNotice(receipt: string, step: string, running: VaultAction | null): string {
		if (running) {
			if (!receipt.startsWith('working:' + running + ':'))
				return 'Waiting for administrator approval.';
			if (step === 'engine' && running === 'remove') return 'Stopping the private Docker engine.';
			return (steps[step] ?? 'Updating Vault') + '…';
		}
		if (receipt === 'absent')
			return removed
				? 'Vault was removed. Private data was archived.'
				: 'Set up the isolated executor used by Credential Vault.';
		if (receipt === 'ready') return 'Vault is set up on this computer.';
		return 'Vault needs attention. Last step: ' + (steps[step] ?? 'Checking Vault setup') + '.';
	}

	async function refresh() {
		if (!bridge) return;
		try {
			status = await bridge.status();
		} catch {
			error = 'Could not read Vault setup status.';
		}
	}

	async function run(next: VaultAction) {
		if (!bridge || action) return;
		startingFresh = status === 'absent';
		action = next;
		removed = false;
		error = null;
		try {
			error = await bridge.run(next);
			removed = !error && next === 'remove';
		} catch {
			error = 'Vault setup could not reach the local installer.';
		} finally {
			await refresh();
			action = null;
		}
	}

	onMount(() => {
		bridge = (window as Window & { vaultSetup?: VaultSetupBridge }).vaultSetup;
		if (!bridge) return;
		void refresh();
		const timer = setInterval(() => {
			if (action) void refresh();
		}, 500);
		return () => clearInterval(timer);
	});
</script>

{#if status !== 'unsupported'}
	<hx-section class="vault-card" aria-label="Credential Vault" data-harness-component="vault-setup">
		<hx-h2>Credential Vault</hx-h2>
		<hx-p role="status">{notice}</hx-p>
		{#if error}<hx-p class="error" role="alert">{error}</hx-p>{/if}
		<hx-div class="actions">
			{#if showSetup}
				<hx-button
					class="vault-button"
					type="button"
					disabled={!!action}
					onclick={() => run('setup')}
				>
					Set up vault on this computer
				</hx-button>
			{:else}
				<hx-button
					class="vault-button"
					type="button"
					disabled={!!action}
					onclick={() => run('setup')}
				>
					Repair vault
				</hx-button>
				<hx-button
					class="vault-button"
					type="button"
					disabled={!!action}
					onclick={() => run('remove')}
				>
					Remove vault
				</hx-button>
			{/if}
		</hx-div>
	</hx-section>
{/if}

<style>
	.vault-card {
		display: grid;
		gap: var(--hx-space-12);
		padding: var(--hx-space-18) var(--hx-space-20);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-large);
		background: var(--hx-color-surface);
	}
	h2,
	p {
		margin: 0;
	}
	h2 {
		padding-bottom: var(--hx-space-12);
		border-bottom: var(--hx-border-thin) solid var(--hx-color-border);
		font-size: var(--hx-type-size-sm);
	}
	p {
		color: var(--hx-color-text-muted);
	}
	.error {
		color: var(--hx-color-error);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-8);
	}
	.vault-button {
		padding: var(--hx-space-8) var(--hx-space-12);
		min-height: 44px;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-surface);
		color: inherit;
		cursor: pointer;
	}
	.vault-button:disabled {
		opacity: 0.55;
		cursor: default;
	}
</style>
