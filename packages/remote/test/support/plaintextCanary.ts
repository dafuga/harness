import { expect } from 'vitest';
import { remoteBytes, toBase64, toHex } from '../../src/utils/networking-security/remoteBytes';

function base64Forms(bytes: Uint8Array): string[] {
	const forms: string[] = [];
	for (let shift = 0; shift < 3; shift++) {
		const encoded = toBase64(new Uint8Array([...new Uint8Array(shift), ...bytes]));
		// Drop the characters touched by the shift prefix and by the final partial group.
		const inner = encoded.slice(Math.ceil((shift * 4) / 3) + 1, -4);
		if (inner.length >= 8) forms.push(inner, inner.replace(/\+/g, '-').replace(/\//g, '_'));
	}
	return forms;
}

/** Every way a canary could appear in captured traffic: UTF-8, hex and base64 at any alignment. */
export function canaryForms(canary: string): string[] {
	const bytes = remoteBytes(canary);
	return [canary, toHex(bytes), toHex(bytes).toUpperCase(), ...base64Forms(bytes)];
}

function asText(value: string | Uint8Array): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('latin1').decode(value);
}

/** Fails when any canary, in any encoding, appears in anything the server stored or received. */
export function expectNoPlaintext(captured: (string | Uint8Array)[], canaries: string[]): void {
	const haystack = captured.map(asText);
	const binary = captured.filter((value): value is Uint8Array => typeof value !== 'string');
	for (const canary of canaries) {
		for (const form of canaryForms(canary))
			expect(
				haystack.some((text) => text.includes(form)),
				`server saw ${canary} as ${form}`
			).toBe(false);
		const raw = remoteBytes(canary);
		expect(
			binary.some((bytes) => containsBytes(bytes, raw)),
			`server saw raw ${canary}`
		).toBe(false);
	}
}

function containsBytes(bytes: Uint8Array, needle: Uint8Array): boolean {
	outer: for (let start = 0; start + needle.length <= bytes.length; start++) {
		for (let index = 0; index < needle.length; index++)
			if (bytes[start + index] !== needle[index]) continue outer;
		return true;
	}
	return false;
}
