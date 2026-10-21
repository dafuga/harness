import type { RemoteHostRegisterInput, RemoteHostRegistration } from '../../../../remote/src/index';

export type RegisterRemoteHost = (
	input: RemoteHostRegisterInput
) => Promise<RemoteHostRegistration>;

export {
	remoteHostIdentity,
	registerRemoteHost
} from '../../services/networking-security/remote-host-service/remote-host-switch-service/remoteHostIdentity';
