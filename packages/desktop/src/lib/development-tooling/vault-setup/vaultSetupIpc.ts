import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { macVaultInstaller } from '../../../../../../deploy/vault/setup/macInstaller';
import { trustedSender } from '../desktop-initialization/initialize-desktop/trustedSender';

export function vaultSetupIpc(current: () => BrowserWindow | undefined): void {
	const installer = macVaultInstaller();
	ipcMain.handle('vault-setup:status', (event) => {
		const window = current();
		if (process.platform !== 'darwin' || !window || !trustedSender(event, window))
			return 'unsupported';
		return installer.status();
	});
	ipcMain.handle('vault-setup:run', (event, action: unknown) => {
		const window = current();
		if (process.platform !== 'darwin' || !window || !trustedSender(event, window))
			return 'Vault setup requires the local Harness Mac window.';
		if (action !== 'setup' && action !== 'remove') return 'Unknown Vault operation.';
		return installer.run(action);
	});
}
