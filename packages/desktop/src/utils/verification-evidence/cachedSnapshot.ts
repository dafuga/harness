// @harness-uid u_4t5hat4ixp
export interface SavedCopy {
	cachedAt: string;
	/** Whose copy it is: the identity of this phone. */
	principal: string;
}

export { cachedSnapshot } from '../../lib/verification-evidence/select-environment/capacitor-bridge-adapter/cachedSnapshot';
