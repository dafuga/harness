// @harness-uid u_kg5hqb4cde
import type { RunbookSource } from '../../../core/agents-providers/runbookCanvas.types';
import { redactSecrets } from '../../../utils/agents-providers/redactSecrets';

const qaVideoBlock = /^```qa-video[\s\S]*?^```[^\S\r\n]*$/gm;

function cleanLinks(markdown: string, allowedOrigins: readonly string[]): string {
	return markdown
		.replace(/<[^>]*>/g, '')
		.replace(/!?\[([^\]\n]*)\]\(([^)\n]*)\)/g, (_all, label: string, target: string) => {
			const safe = cleanUrl(target, allowedOrigins);
			return safe ? `[${label}](${safe})` : label;
		})
		.replace(
			/https?:\/\/[^\s<>)\]]+/gi,
			(target) => cleanUrl(target, allowedOrigins) ?? '[link removed]'
		);
}

function cleanUrl(target: string, allowedOrigins: readonly string[]): string | undefined {
	const url = URL.parse(target);
	if (url && !url.username && !url.password && allowedOrigins.includes(url.origin))
		return url.origin + url.pathname;
	return undefined;
}

/** One canvas: a contents list, then each runbook as its own section. Secrets and foreign links removed. */
export function runbookCanvasMarkdown(
	title: string,
	runbooks: readonly RunbookSource[],
	allowedOrigins: readonly string[]
): string {
	const sections = runbooks.map((runbook) => {
		const body = runbook.markdown.replace(qaVideoBlock, '').trim();
		return redactSecrets(cleanLinks(body, allowedOrigins));
	});
	const contents = sections
		.map((section) => section.match(/^#\s+(.+)$/m)?.[1]?.trim())
		.map((heading, i) => `- ${heading ?? runbooks[i].path}`);
	return [
		`# ${title}`,
		'',
		'Read-only copy of the project QA runbooks. Edits happen in the repository.',
		'',
		...contents,
		'',
		...sections.flatMap((s) => [s, ''])
	].join('\n');
}
