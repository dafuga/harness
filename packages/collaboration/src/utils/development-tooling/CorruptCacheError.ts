// @harness-uid u_caosuneq3x
/** A cached entry whose identity, bytes, or requested artifactHash fails verification; readCache deletes it and resolves null. */
export class CorruptCacheError extends Error {
	override name = 'CorruptCacheError';
}
