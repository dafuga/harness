// @harness-uid u_2c64lq6rce
import type { TrackerAttachmentSource } from './parseTrackerAttachmentWord.types';

const remote =
	/^(?<repo>[\w.-]+\/[\w.-]+)(?:#(?<pr>[1-9]\d{0,7}))?:(?<path>[^@]+?)(?:@(?<ref>[0-9a-f]{7,40}))?$/;

/** @pure `owner/repo#PR:path[@commit]`, the form of `--spec` and of a GitHub `--doc`. */
export function parseTrackerAttachmentWord(word: string): TrackerAttachmentSource | null {
	const parts = remote.exec(word.trim())?.groups;
	if (!parts || (!parts.pr && !parts.ref)) return null;
	const path = parts.path.replace(/^\/+/, '');
	if (path.split('/').includes('..')) return null;
	return {
		repo: parts.repo,
		path,
		...(parts.pr && { pr: Number(parts.pr) }),
		...(parts.ref && { ref: parts.ref })
	};
}
