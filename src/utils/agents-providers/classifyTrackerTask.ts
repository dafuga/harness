// @harness-uid u_6owiaffoxw
import type {
	TrackerModelItem,
	TrackerTaskKind,
	TrackerTaskRoute,
	TrackerTaskSize
} from './classifyTrackerTask.types';

// Tracker's title rules take precedence over the notes, including notes from earlier attempts.
const kindRules: [TrackerTaskKind, RegExp][] = [
	[
		'hard',
		/\[hard\]|\b(smart contracts?|concurrency|race conditions?|deadlocks?|tricky|hard bug|consensus|cryptograph\w*)\b/i
	],
	['ops', /\b(deploy|promot|release|production|prod\b|infra|migrat(e|ion) (the )?(db|database))/i],
	['refactor', /\b(refactor|rewrite|re-architect|architecture|redesign|overhaul|migrate)/i],
	['docs', /\b(readme|docs?\b|documentation|typo|wording|copy ?edit|changelog|comment)/i],
	['chore', /\b(bump|upgrade dep|dependenc|lint|format|rename|config|cleanup|clean up)/i],
	['bugfix', /\b(fix|bug|error|crash|broken|regression|fails?|failing|issue #?\d)/i],
	['test', /\b(tests?|coverage|e2e|playwright)\b/i],
	[
		'triage',
		/\b(triage|status|check(s|ing)?|research|summar\w*|report|review|audit|investigate|inventory|list)\b/i
	]
];

const floorRules: [string, RegExp][] = [
	[
		'secrets',
		/\b(secrets?|credentials?|api[ _-]?keys?|access[ _-]?tokens?|tokens?|passwords?|passphrases?|private[ _-]?keys?|\.env\b|keychain|vault|webhook\.key|sync\.secret)\b/i
	],
	[
		'auth',
		/\b(auth|authn|authz|authenticat\w*|authori[sz]\w*|oauth\w*|log[ -]?ins?|sign[ -]?(in|up|on)|sso|jwt|sessions? cookies?|permissions?|rbac|2fa|mfa|passkeys?)\b/i
	],
	[
		'payments',
		/\b(payments?|stripe|billing|invoices?|checkout|subscriptions?|refunds?|payouts?|pricing plans?)\b/i
	],
	[
		'user data',
		/\b(pii|gdpr|ccpa|privacy|personal data|user data|customer data|user records?|delete (my |the |user )?accounts?|data export)\b/i
	],
	[
		'production/infra',
		/\b(production|prod|deploy\w*|infra\w*|dns|cloudflare|wrangler|terraform|kubernetes|k8s|firewall|load balancer|cdn|ssh config)\b/i
	],
	['migrations', /\bmigrat\w*/i],
	[
		'security',
		/\b(security|secure|vulnerab\w*|cve-\d+|xss|csrf|ssrf|injection|exploit|encrypt\w*|decrypt\w*|tls|ssl|certificates?|sandbox)\b/i
	],
	[
		'legal/finance/health',
		/\b(legal|contracts?|terms of service|privacy policy|compliance|financ\w*|tax(es)?|accounting|bank\w*|health|medical|hipaa)\b/i
	]
];

const database =
	/\b(databases?|db|schemas?|migrat\w*|sql|d1|sqlite|postgres\w*|mysql|data[ -]?fix(es)?|backfill\w*|alter table|drop table|insert into|delete from|update \w+ set|indexes on|add (a )?column|seed data)\b/i;
const promotion =
	/\b(merg(e|es|ed|ing) (the |this |a |my )?(prs?|pull requests?)|merg(e|ing) \S+ (in)?to (main|master|dev|develop|staging|preprod|prod|production)|promot\w*|release tags?|tag (a |the )?release|cut (a |the )?release|git tag|publish (a |the )?release)\b/i;
const liveEnvironment = String.raw`(?:pre[- ]?prod(?:uction)?|prod(?:uction)?)`;
const releaseVerb =
	/^(?:please\s+)?(?:deploy|promote|release|roll out|roll back|ship|publish|merge)\b/i;
const liveTarget = new RegExp(
	String.raw`(?:\b(?:to|into|on)\s+|(?:→|->)\s*)(?:the\s+)?${liveEnvironment}\b`,
	'i'
);
const liveAction = new RegExp(
	String.raw`^${liveEnvironment}\s+(?:deploy(?:ment)?|release|rollout|rollback|promotion)\b(?!\s+(?:plan|checklist|logs?|script|docs?|notes?)\b)|^(?:deploy|release|roll back)\s+${liveEnvironment}(?:\s+from\b|\s*$)`,
	'i'
);
const liveTargetField = new RegExp(
	String.raw`^(?:target(?: environment)?|environment)\s*:\s*${liveEnvironment}\b`,
	'im'
);
const computerUse =
	/^\[?computer[- ]use\b|\b(?:use|using|via|requires?)\s+(?:codex\s+)?computer[- ]use\b|^(?:please\s+)?(?:open|visit|navigate|browse|interact|click|tap|use|manually (?:test|verify|check))\b[^.!?\n;]*\b(?:browser|chrome|safari|firefox|edge|desktop app|mobile app|iphone|ipad)\b/i;
const visualDesign =
	/^(?:mock[ -]?ups?|wireframes?|designs? for|visual (?:polish|designs?)|screenshot review|review (?:the )?designs)\b|\b(?:design|redesign|build|create|draw|generate|review|revise|prepare|polish|restyle)\b[^.!?\n;]*\b(?:mock[ -]?ups?|wireframes?|visual (?:designs?|polish))\b|\b(?:design|redesign|polish|restyle)\b[^.!?\n;]*\b(?:screens?|ui|dashboard|pages?|views?|layout|components?)\b/i;

export function trackerTaskRoute(item: TrackerModelItem): TrackerTaskRoute {
	const title = item.title ?? '';
	const details = title + '\n' + (item.notes ?? '');
	const actions = details
		.split(/[\n;]+|,\s*|\band (?:then )?/i)
		.map((part) => part.replace(/^\s*(?:[-*]\s+|\d+[.)]\s+)?/, '').trim());
	if (
		actions.some(
			(part) => liveAction.test(part) || (releaseVerb.test(part) && liveTarget.test(part))
		) ||
		(releaseVerb.test(title.trim()) && liveTargetField.test(details))
	)
		return 'live-deploy';
	if (actions.some((part) => computerUse.test(part))) return 'computer-use';
	if (
		actions.some((part) => visualDesign.test(part)) ||
		isVisualInspection(item) ||
		isVisualInspection({ title: item.notes })
	)
		return 'visual';
	return 'default';
}

export function classifyTrackerTask(item: TrackerModelItem): TrackerTaskKind {
	const titleMatch = kindRules.find(([, rule]) => rule.test(item.title ?? ''));
	const notesMatch = titleMatch ?? kindRules.find(([, rule]) => rule.test(item.notes ?? ''));
	return notesMatch?.[0] ?? 'feature';
}

export function sizeOf(item: TrackerModelItem): TrackerTaskSize {
	const text = `${item.title ?? ''}\n${item.notes ?? ''}`;
	const bullets = (text.match(/^\s*([-*]|\d+\.)\s/gm) ?? []).length;
	if (text.length > 1500 || bullets >= 8) return 'large';
	if (text.length < 200 && bullets <= 1) return 'small';
	return 'medium';
}

export function projectOf(item: TrackerModelItem): string | null {
	return [item.project, item.agent].find(Boolean) ?? null;
}

export function floorReasons(item: TrackerModelItem): string[] {
	const text = [item.title, item.notes, item.project].filter(Boolean).join('\n');
	const reasons: string[] = [];
	if (item.sensitive) reasons.push('marked sensitive');
	const hits = floorRules.filter(([, rule]) => rule.test(text)).map(([name]) => name);
	if (hits.length) reasons.push(`sensitive (${hits.join(', ')})`);
	if (database.test(text)) reasons.push('database change');
	if (promotion.test(text)) reasons.push('GitHub promotion');
	return reasons;
}

export function isHarnessModule(item: TrackerModelItem): boolean {
	const project = projectOf(item);
	return (
		/^harness(?:[- ](?:modules?|integration))?$/i.test(project ?? '') &&
		/\bmodules?\b/i.test(`${item.title ?? ''}\n${item.notes ?? ''}\n${project}`)
	);
}

export function isVisualInspection(item: TrackerModelItem): boolean {
	const title = item.title ?? '';
	return (
		/\b(review|inspect|compare|check|describe|audit)\b/i.test(title) &&
		/\b(screenshot|visual|layout|mockup|image)s?\b/i.test(title)
	);
}

export function solEffort(kind: TrackerTaskKind, _size: TrackerTaskSize): string {
	return kind === 'hard' ? 'high' : 'medium';
}
