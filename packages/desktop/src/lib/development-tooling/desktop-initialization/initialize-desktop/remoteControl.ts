// @harness-uid u_sgpbhpykjm
import type { LocalControl } from '../LocalOperationsService';
import type { RemoteHostService } from '../../../../services/networking-security/remote-host-service/RemoteHostService';

/** The remote controls a window's client may use, each one bound to the running remote host. */
export function remoteControl(remote: RemoteHostService): LocalControl {
	const { devices } = remote;
	return {
		status: () => remote.status(),
		enable: () => remote.enable(),
		disable: () => remote.disable(),
		approvePairing: (input) => devices.approvePairing(input),
		denyPairing: (input) => devices.denyPairing(input),
		revokeDevice: (input) => devices.revokeDevice(input)
	};
}
