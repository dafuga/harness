// @harness-uid u_dmrprh2qpw
import type {
	HomeLimit,
	HomeSubscription
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { providerNames, staleReading, warningFor, warningLabel } from './hubHomePresentation';
import { resetClock } from './hubHomeTime';

const shortNames = { claude: 'Claude', codex: 'Codex' } as const;
const products = {
	claude: 'Anthropic Claude Code subscription',
	codex: 'OpenAI Codex subscription'
} as const;

function windowName(limit: HomeLimit) {
	if (/^5-hour/i.test(limit.label)) return '5h';
	return limit.label.charAt(0).toLowerCase() + limit.label.slice(1);
}

function windowMeaning(name: string) {
	if (name === '5h') return '5-hour limit';
	const model = /^weekly (.+)$/.exec(name)?.[1];
	return model ? `weekly limit for ${model}` : `${name} limit`;
}

/** A model's own weekly limit joins the pill only once it runs low; the worst limit leads. */
function pillLimits(limits: HomeLimit[]) {
	const rank = (limit: HomeLimit) => (warningFor(limit.left) ? limit.left : 101);
	return limits
		.filter((limit) => !limit.id.startsWith('weekly-') || warningFor(limit.left))
		.sort((a, b) => rank(a) - rank(b));
}

function limitText(limit: HomeLimit, now: number) {
	const state = limit.left <= 0 ? `· ${resetClock(limit.resetsAt, now)}` : `${limit.left}% left`;
	return `${windowName(limit)} ${state}`;
}

function unknownPill(id: string, provider: HomeSubscription['provider']) {
	const name = shortNames[provider];
	return {
		id,
		provider,
		level: null,
		word: null,
		text: `${name} usage unknown`,
		meaning: `${name}: no ${providerNames[provider]} reading from the last hour, so what is left is unknown.`
	};
}

function readingPill(subscription: HomeSubscription, now: number) {
	const { id, provider } = subscription;
	const limits = pillLimits(subscription.limits);
	if (!limits.length || staleReading(subscription.readAt, now)) return unknownPill(id, provider);
	const name = shortNames[provider];
	const [worst] = limits;
	const tone = warningFor(worst.left);
	return {
		id,
		provider,
		level: worst.left <= 0 ? ('out' as const) : tone,
		word: tone ? warningLabel(worst) : null,
		text: `${name} ${limits.map((limit) => limitText(limit, now)).join(' · ')}`,
		meaning: limits
			.map(windowName)
			.map((window) => `${name} ${window}: ${products[provider]} ${windowMeaning(window)}.`)
			.join(' ')
	};
}

/** One header pill per subscription, Claude first; a provider with no reading still has one. */
export function quotaPills(subscriptions: HomeSubscription[], now: number) {
	return (['claude', 'codex'] as const).flatMap((provider) => {
		const own = subscriptions.filter((subscription) => subscription.provider === provider);
		if (!own.length) return [unknownPill(`missing-${provider}`, provider)];
		return own.map((subscription) => readingPill(subscription, now));
	});
}
