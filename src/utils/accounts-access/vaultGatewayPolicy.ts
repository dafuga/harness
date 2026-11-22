// @harness-uid u_vjf6edhc5l
import type {
	VaultDecision,
	VaultGatewayScope,
	VaultOperation,
	VaultOperationName
} from './vaultGatewayPolicy.types';

export const readOperations = [
	'navigate',
	'back',
	'reload',
	'snapshot',
	'screenshot',
	'scroll',
	'waitFor',
	'finish'
] as const;
export const writeOperations = ['click', 'fill', 'select', 'press', 'submit', 'download'] as const;

const navigating = new Set<string>(['navigate', 'submit']);

/** Path segments that create or show keys and tokens, or change recovery, 2FA or sessions. A recipe cannot allow them. */
const protectedSegment =
	/^(api[-_]?keys?|apikeys|keys|tokens?|access[-_]?tokens?|personal[-_]?access[-_]?tokens?|oauth[-_]?apps?|developer[-_]?settings|credentials?|secrets?|recovery|recovery[-_]?codes|backup[-_]?codes|two[-_]?factor|2fa|mfa|tfa|totp|security|passkeys?|security[-_]?keys|webauthn|passwords?|sessions?|authorized[-_]?apps|connected[-_]?apps|authentication)$/iu;

/** Decides one gateway call for a lease: listed operation, lease mode, then URL policy. */
export function vaultGatewayPolicy(
	scope: VaultGatewayScope,
	operation: VaultOperation
): VaultDecision {
	const refusal = operationRefusal(scope, operation);
	if (refusal) return { allowed: false, reason: refusal };
	if (navigating.has(operation.name) && operation.url !== undefined) {
		return vaultUrlPolicy(scope, operation.url);
	}
	if (operation.name === 'navigate') {
		return { allowed: false, reason: 'Navigation needs a target URL.' };
	}
	return { allowed: true };
}

/** Deny-by-default URL check for navigations, redirects and form targets. */
export function vaultUrlPolicy(scope: VaultGatewayScope, target: string): VaultDecision {
	const url = parseUrl(target);
	if (!url || !scope.origins.concat(scope.redirects).includes(url.origin)) {
		return { allowed: false, reason: 'The target is outside the approved origins.' };
	}
	if (touchesProtected(url)) {
		return {
			allowed: false,
			reason: 'The target manages keys, tokens, recovery, 2FA or sessions.'
		};
	}
	if (scope.deny.some((pattern) => pathMatches(pattern, url.pathname))) {
		return { allowed: false, reason: 'The recipe denies this path.' };
	}
	if (
		scope.origins.includes(url.origin) &&
		!scope.paths.some((p) => pathMatches(p, url.pathname))
	) {
		return { allowed: false, reason: 'The path is not part of the approved action.' };
	}
	return { allowed: true };
}

/** Matches a recipe path pattern: `*` is one segment, a trailing `/**` is any remainder. */
export function pathMatches(pattern: string, path: string): boolean {
	const want = pattern.split('/').filter(Boolean);
	const have = path.split('/').filter(Boolean);
	const rest = want.at(-1) === '**';
	const fixed = rest ? want.slice(0, -1) : want;
	if (rest ? have.length < fixed.length : have.length !== fixed.length) return false;
	return fixed.every((segment, index) => segment === '*' || segment === have[index]);
}

function touchesProtected(url: URL): boolean {
	const parts = url.pathname.split('/').concat(url.hash.replace(/^#\/?/u, '').split(/[/?&=]/u));
	for (const [key, value] of url.searchParams) parts.push(key, value);
	return parts.some((part) => protectedSegment.test(safeDecode(part)));
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function parseUrl(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

function operationRefusal(scope: VaultGatewayScope, operation: VaultOperation): string | null {
	const name = operation.name as VaultOperationName;
	const isRead = (readOperations as readonly string[]).includes(name);
	if (!isRead && !(writeOperations as readonly string[]).includes(name)) {
		return 'Operation ' + operation.name + ' is not offered by the gateway.';
	}
	if (!isRead && scope.mode !== 'write') return 'The lease is read-only.';
	if (name === 'download' && !scope.downloads.includes(operation.fileType ?? '')) {
		return 'The action allows no download of this file type.';
	}
	return null;
}
