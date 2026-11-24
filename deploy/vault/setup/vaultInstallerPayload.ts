import common from './common.sh' with { type: 'text' };
import macos from './macos.sh' with { type: 'text' };
import linux from './linux.sh' with { type: 'text' };

export function vaultInstallerPayload(platform: 'darwin' | 'linux'): string {
	return [common, platform === 'darwin' ? macos : linux, 'vault_main "$@"'].join('\n');
}
