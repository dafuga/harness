// @harness-uid u_dv4lnm54rz
import type {
	TrackerBlockerClassification,
	TrackerBlockerRoute,
	TrackerBlockerType
} from './trackerBlockerTypes.types';

const credential =
	/\b(credentials?|api[- ]?keys?|access[- ]tokens?|auth[- ]tokens?|tokens? (?:is |are |was )?(?:missing|absent|expired|invalid|revoked)|secrets?|passwords?|passcodes?|oauth|2fa|mfa|log ?in|sign[- ]?in|permissions?|unauthori[sz]ed|forbidden|40[13]|ssh keys?|vault|access (?:to|denied|required|is)|(?:no|needs?|missing|without|lacks?) access|installation token|fine-grained pat)\b/i;
const payment =
	/\b(billing|payments?|invoices?|subscriptions?|credit card|budget|spend(?:ing)?|purchase|paid plan|upgrade (?:the |our )?plan|out of credits|price|pricing|cost|\$\s?\d)/i;
const decision =
	/\b(needs? daniel|daniel (?:to )?(?:decide|approve|choose|confirm)|approvals?|approve|decisions?|your call|go-?ahead|sign-?off|which (?:option|one)|should (?:i|we)|choose between|pick (?:one|between))\b|\?\s*$/i;
const waiting =
	/\b(?:waiting (?:on|for)|blocked by|depends on|behind|after|until)\s+(?:tracker\s+)?(item\s+)?(\[)?([a-z0-9]{6})\]?(?![a-z0-9])/i;
const externalLower =
	/\b(replies|reply|respond|responds|response|vendor|customers?|support (?:team|ticket)|third[- ]party|partners?|app store review|colleagues?|coworkers?|teammates?|transcript from|external)\b/;
const externalNamed = /\bwaiting (?:on|for) (?:a |the )?[A-Z][a-z]+/;

const external = (text: string) => externalLower.test(text) || externalNamed.test(text);

/** Name the kind of blocker from its reason or question. Flags default to a Daniel decision. */
export function classifyTrackerBlocker(
	text: string | null | undefined,
	fallback: 'block' | 'flag' = 'block'
): TrackerBlockerClassification {
	const value = (text ?? '').trim();
	const waitsOn = dependency(value);
	const asked = fallback === 'flag';
	const rules: [boolean, TrackerBlockerType][] = [
		[credential.test(value), 'credential_access'],
		[payment.test(value), 'payment_cost'],
		[asked && decision.test(value), 'daniel_decision'],
		[waitsOn !== null, 'waiting_on_item'],
		[external(value), 'external_person'],
		[decision.test(value) || asked, 'daniel_decision']
	];
	const type = rules.find(([matches]) => matches)?.[1] ?? 'technical';
	return { type, waitsOn };
}

function dependency(text: string): string | null {
	const match = waiting.exec(text);
	if (!match) return null;
	const [, item, bracket, id] = match;
	return item || bracket || /\d/.test(id) ? id.toLowerCase() : null;
}

/** Credential, decision and cost blockers are Daniel's to unblock. */
export function trackerBlockerRoute(type: TrackerBlockerType): TrackerBlockerRoute {
	if (type === 'credential_access' || type === 'daniel_decision' || type === 'payment_cost')
		return 'needs_daniel';
	if (type === 'waiting_on_item') return 'dependency';
	return type === 'technical' ? 'orchestrator' : 'owner';
}

export function escalatesToDaniel(type: TrackerBlockerType): boolean {
	return trackerBlockerRoute(type) === 'needs_daniel';
}
