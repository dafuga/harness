export interface SavedCopy {
	cachedAt: string;
	/** Whose copy it is: the identity of this phone. */
	principal: string;
}

export { cachedSnapshot } from './select-environment/capacitor-bridge-adapter/cachedSnapshot';
