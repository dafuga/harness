// @harness-uid u_rzug3edbcj
import type { VaultPageNode, VaultPageSnapshot, VaultScrubResult } from './vaultPageScrub.types';

const sensitiveName =
	/(csrf|xsrf|nonce|token|secret|session|authenticity|state|password|passwd|otp|api[-_]?key|bearer|cookie|signature)/iu;
const credentialValue = [
	/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u,
	/^[A-Fa-f0-9]{32,}$/u,
	/^[A-Za-z0-9+/_-]{32,}={0,2}$/u,
	/^(sk|rk|pk|npm|ghp|gho|xox[a-z])[-_][A-Za-z0-9_-]{8,}$/u
];

/**
 * Removes hidden inputs, CSRF meta tags and token-bearing attributes, and blanks password and
 * credential-like values, before a snapshot leaves the gateway.
 */
export function vaultPageScrub(snapshot: VaultPageSnapshot): VaultScrubResult {
	const counter = { removed: 0 };
	const nodes = scrubNodes(snapshot.nodes, counter);
	return {
		snapshot: { url: scrubUrl(snapshot.url, counter), title: snapshot.title, nodes },
		removed: counter.removed
	};
}

function scrubNodes(nodes: VaultPageNode[], counter: { removed: number }): VaultPageNode[] {
	const kept: VaultPageNode[] = [];
	for (const node of nodes) {
		if (dropsNode(node)) {
			counter.removed += 1;
			continue;
		}
		kept.push(scrubNode(node, counter));
	}
	return kept;
}

function scrubNode(node: VaultPageNode, counter: { removed: number }): VaultPageNode {
	const next: VaultPageNode = { ...node };
	if (node.attributes) next.attributes = scrubAttributes(node.attributes, counter);
	if (node.value !== undefined && (node.type === 'password' || isSecretField(node))) {
		next.value = '';
		counter.removed += 1;
	}
	if (node.children) next.children = scrubNodes(node.children, counter);
	return next;
}

function dropsNode(node: VaultPageNode): boolean {
	const tag = node.tag.toLowerCase();
	if (tag === 'input' && (node.type ?? node.attributes?.type) === 'hidden') return true;
	if (tag === 'meta') return sensitiveName.test(node.attributes?.name ?? '');
	return tag === 'script' || tag === 'template' || tag === 'noscript';
}

function isSecretField(node: VaultPageNode): boolean {
	return (
		sensitiveName.test(node.attributes?.name ?? '') ||
		sensitiveName.test(node.attributes?.id ?? '') ||
		looksLikeCredential(node.value ?? '')
	);
}

function scrubAttributes(
	attributes: Record<string, string>,
	counter: { removed: number }
): Record<string, string> {
	const kept: Record<string, string> = {};
	for (const [key, value] of Object.entries(attributes)) {
		if (sensitiveName.test(key) || key.startsWith('data-') || looksLikeCredential(value)) {
			counter.removed += 1;
			continue;
		}
		kept[key] = value;
	}
	return kept;
}

function scrubUrl(value: string, counter: { removed: number }): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return value;
	}
	for (const [key, entry] of [...url.searchParams]) {
		if (!sensitiveName.test(key) && !looksLikeCredential(entry) && key !== 'code') continue;
		url.searchParams.set(key, 'redacted');
		counter.removed += 1;
	}
	if (url.hash.length > 1) {
		url.hash = '';
		counter.removed += 1;
	}
	return url.toString();
}

function looksLikeCredential(value: string): boolean {
	const text = value.trim();
	return text.length >= 20 && !/\s/u.test(text) && credentialValue.some((rule) => rule.test(text));
}
