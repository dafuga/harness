const explained: Record<string, string> = {
	'session-required': 'Sign in to continue.',
	forbidden: 'You do not have access to this.',
	'not-found': 'This does not exist, or you do not have access to it.',
	'invalid-input': 'The request was not accepted. Check what you entered.',
	'invalid-request': 'The request was not accepted. Check what you entered.',
	'invitation-invalid': 'This invitation or code is not valid for the account you signed in with.',
	'invitation-expired': 'This invitation has expired. Ask the owner for a new one.',
	'handoff-invalid': 'This code is wrong, expired or already used. Start again in the desktop app.',
	'email-proof-required': 'Confirm your email address before continuing.',
	'email-code-invalid': 'That code is not right or has expired. Check it, or send a new one.',
	'email-rate-limited': 'Too many attempts. Wait a few minutes before trying again.',
	'email-delivery-disabled':
		'This deployment cannot send email yet, so this address cannot be confirmed here. Nothing was sent.',
	'email-delivery-failed': 'The email could not be sent. Nothing was delivered; try again shortly.',
	'auth-disabled': 'Sign-in is not configured for this deployment.',
	'github-disabled': 'The GitHub App is not configured for this deployment.',
	'github-not-connected': 'Connect GitHub before creating a project.',
	'repository-denied': 'GitHub does not show you as an administrator of this repository.',
	'collaboration-disabled': 'Shared comments are not configured for this deployment.',
	'hosted-execution-denied': 'The hosted workspace runs no agent and changes no plan.',
	'credential-invalid': 'This Google account could not be verified. Try signing in again.',
	'challenge-invalid': 'The sign-in attempt expired. Try signing in again.',
	'email-not-authoritative': 'This Google account has no verified email address.',
	'origin-denied': 'The request did not come from this site.',
	'revision-mismatch': 'The branch moved while it was read. Reload to see its tip.',
	'github-unavailable': 'GitHub could not be reached. Try again shortly.',
	unavailable: 'The project could not be read right now. Try again shortly.'
};

/** Words for a coded API failure. A code that is not known reveals nothing of the server. */
export function browserError(code: string, status: number): string {
	if (Object.hasOwn(explained, code)) return explained[code];
	return status ? `The request failed (${status}).` : 'The server could not be reached.';
}
