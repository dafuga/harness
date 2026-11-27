// @harness-uid u_kg5hqq4vwx
import { ProjectAssistantError } from '../../../core/agents-providers/ProjectAssistantError';
import type {
	AssistantSource,
	UntrustedValue
} from '../../../core/agents-providers/projectAssistant.types';
import type { ToolInput } from './assistantTool.types';

export function positiveInt(value: UntrustedValue): number {
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number < 1)
		throw new ProjectAssistantError('A positive number is required.');
	return number;
}

export function str(value: UntrustedValue, max = 200): string {
	return typeof value === 'string' ? value.slice(0, max) : '';
}

export function arr(value: UntrustedValue): ToolInput[] {
	return Array.isArray(value)
		? value.filter((v): v is ToolInput => !!v && typeof v === 'object')
		: [];
}

export function issueLine(issue: ToolInput): string {
	const labels = arr(issue.labels)
		.map((label) => str(label.name, 40))
		.join(',');
	const kind = issue.pull_request ? 'PR' : 'Issue';
	const suffix = labels ? ` (labels: ${labels})` : '';
	return `${kind} #${issue.number} [${str(issue.state, 10)}] ${str(issue.title)}${suffix}`;
}

export function sourceOf(item: ToolInput, label: string): AssistantSource[] {
	const url = str(item.html_url, 300);
	return url.startsWith('https://github.com/') ? [{ label, url }] : [];
}
