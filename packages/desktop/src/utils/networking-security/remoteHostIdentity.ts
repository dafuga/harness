// @harness-uid u_wcoqscxpf4
import type { RemoteHostRegisterInput, RemoteHostRegistration } from '../../../../remote/src/index';

export type RegisterRemoteHost = (
	input: RemoteHostRegisterInput,
	ownerId?: string
) => Promise<RemoteHostRegistration>;

export {
	remoteHostIdentity,
	registerRemoteHost
} from '../../services/networking-security/remote-host-service/remote-host-switch-service/remoteHostIdentity';
