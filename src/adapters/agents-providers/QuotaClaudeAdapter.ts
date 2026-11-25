// @harness-uid u_attkdntuyv
import type {
	SubscriptionLimit,
	SubscriptionReading
} from '../../services/agents-providers/SubscriptionQuotaService.types';
import type { QuotaClaudeAdapterConfig } from './QuotaClaudeAdapter.types';
import { readClaudeUsage } from './quota-claude-adapter/readClaudeUsage';
import { claudeResetTime } from './quota-claude-adapter/claudeResetTime';

const sections = new Map([
	['current session', { id: '5h', label: '5-hour' }],
	['current week (all models)', { id: 'weekly', label: 'Weekly' }],
	['current week (fable)', { id: 'fable', label: 'Fable' }],
	['current week (fable only)', { id: 'fable', label: 'Fable' }],
	['current week (sonnet only)', { id: 'sonnet', label: 'Sonnet' }],
	['current week (opus only)', { id: 'opus', label: 'Opus' }]
]);

function quotaLimits(text: string, now: number): SubscriptionLimit[] {
	const limits = new Map<string, SubscriptionLimit>();
	let section: { id: string; label: string } | undefined;
	for (const line of text.split(/\r?\n/).map((line) => line.trim())) {
		if (/^(current (session|week)|extra usage)/i.test(line)) {
			section = sections.get(line.toLowerCase());
			continue;
		}
		if (!section) continue;
		const match = /^[^a-z\d]*([0-9]{1,3}(?:\.[0-9]+)?)% used$/i.exec(line);
		if (match && Number(match[1]) <= 100) {
			limits.set(section.id, { ...section, left: 100 - Number(match[1]), resetsAt: null });
		} else if (/^resets\b/i.test(line)) {
			const limit = limits.get(section.id);
			if (limit) limit.resetsAt = claudeResetTime(line, now);
			section = undefined;
		}
	}
	return [...limits.values()];
}

function subscriptionPlan(text: string): string | null {
	const plan = /\bClaude (Max|Pro|Ultra|Team|Enterprise)\b/.exec(text);
	return plan?.[1] ?? null;
}

/** Reads the local Claude Code usage panel and discards the rest of the terminal. */
export class QuotaClaudeAdapter {
	constructor(private readonly config: QuotaClaudeAdapterConfig = {}) {}

	async read(now: number): Promise<SubscriptionReading | null> {
		const text = await (this.config.readUsage ?? readClaudeUsage)();
		const limits = quotaLimits(text, now);
		if (!limits.length) return null;
		return {
			id: 'claude',
			provider: 'claude',
			plan: subscriptionPlan(text),
			account: null,
			readAt: new Date(now).toISOString(),
			limits,
			credits: null,
			history: [],
			agents: []
		};
	}
}

export type { QuotaClaudeAdapterConfig } from './QuotaClaudeAdapter.types';
