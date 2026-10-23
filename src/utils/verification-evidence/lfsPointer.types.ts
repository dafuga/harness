export interface LfsObject {
	/** sha256 of the original bytes, which is also the LFS object id. */
	sha256: string;
	bytes: number;
}
