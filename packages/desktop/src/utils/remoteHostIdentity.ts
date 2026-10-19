import type { RemoteHostRegisterInput, RemoteHostRegistration } from "../../../remote/src/index";

export type RegisterRemoteHost = (
	input: RemoteHostRegisterInput
) => Promise<RemoteHostRegistration>;

export { remoteHostIdentity, registerRemoteHost } from '../services/remote-host-switch-service/remoteHostIdentity';
