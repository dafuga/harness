// @harness-uid u_na5l2yswov
import type { IncludedTrackerItem, TrackerItemRecord } from './projectOverviewTracker.types';

const REDACTED = '[redacted]';

/**
 * Known credential forms, most specific first. Each match is replaced by a fixed marker before any
 * text is shown. Ordinary words (secretary, "API key from vendor") are not matched.
 */
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
	/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )*PRIVATE KEY-----|$)/g,
	/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
	/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
	/\bsk-[A-Za-z0-9_-]{16,}\b/g,
	/\bAKIA[0-9A-Z]{16}\b/g,
	/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
	/\beyJ[\w-]{4,}\.[\w-]{4,}(?:\.[\w-]*)?/g,
	/\bAuthorization\b["']?\s*[=:][^\n]*/gi,
	/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
	/\bBasic\s+(?=[A-Za-z0-9+/]*[0-9+/=])[A-Za-z0-9+/]{8,}={0,2}/g,
	/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi,
	/[?&](?:code|sig|signature|key|auth|session|access_token)=[^&\s#]+/gi,
	/[\w.-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)(?:[_-]\w+)?["']?\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s"'&,;}]+)/gi
];

/** Absolute runtime roots: macOS and Linux homes, temporary, private and volume paths. */
const RUNTIME_ROOT = String.raw`\/(?:Users|home|root|private|tmp|Volumes|var\/(?:folders|tmp))(?![\w.-])`;

/** Local callback hosts: localhost, loopback, unspecified, private and link-local addresses. */
const LOCAL_HOST = String.raw`(?:localhost|0\.0\.0\.0|\[::1\]|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(?=[:/?#\s"'<>]|$)`;

/**
 * Local callbacks, file URLs and absolute runtime paths. Quoted paths go first so a space inside
 * the quotes cannot split a path. Public URLs and relative repo paths do not match.
 */
const LOCATION_PATTERNS: readonly RegExp[] = [
	new RegExp(String.raw`(["'])(?:${RUNTIME_ROOT}|[A-Za-z]:[\\/]|file:\/\/)[^"'\n]*\1`, 'g'),
	new RegExp(
		String.raw`\b(?:https?|wss?):\/\/${LOCAL_HOST}(?::\d{1,5})?(?:[/?#][^\s"'<>]*)?`,
		'gi'
	),
	/\bfile:\/\/[^\s"'<>]*/gi,
	new RegExp(String.raw`(?<![\w.~:/-])${RUNTIME_ROOT}[^\s"'<>]*`, 'g'),
	/(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s"'<>|?*]*/g
];

/** @pure Replace every known credential form, local callback and runtime path in free text with a fixed marker. */
export function sanitizeText(text: string): string {
	return [...CREDENTIAL_PATTERNS, ...LOCATION_PATTERNS].reduce(
		(out, pattern) => out.replace(pattern, REDACTED),
		text
	);
}

/**
 * @pure Only items that may appear on a card. Deleted and sensitive records are dropped,
 * ignored records never affect a state, and an item with no agent names no project.
 */
export function isIncludedItem(item: TrackerItemRecord): item is IncludedTrackerItem {
	return (
		!item.deleted &&
		!item.sensitive &&
		item.status !== 'ignored' &&
		typeof item.agent === 'string' &&
		item.agent.length > 0
	);
}
