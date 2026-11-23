// @harness-uid u_3fzup4c76j
/** A native sign-in that cannot start without OS encryption, or whose handoff was not approved. */
export class NativeSignInError extends Error {
	override name = 'NativeSignInError';
}
