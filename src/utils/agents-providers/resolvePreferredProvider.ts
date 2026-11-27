// @harness-uid u_tta7f4pk5v
import type { TrackerPreferredProvider, TrackerProvider } from './resolvePreferredProvider.types';

const providerLabel = { claude: 'Claude', codex: 'Codex' };
const lisbonTime = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Lisbon',
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** Resolves the active provider and the reason attached to Tracker run receipts. */
export function resolvePreferredProvider(setting: TrackerPreferredProvider, now: number) {
	const { provider, until } = setting;
	const switchAt = until ? Date.parse(until) : NaN;
	if (!Number.isFinite(switchAt)) return { provider, why: `${providerLabel[provider]} preferred` };
	const when = `${lisbonTime.format(switchAt)} Lisbon`;
	if (now < switchAt)
		return { provider, why: `${providerLabel[provider]} preferred until ${when}` };
	const next: TrackerProvider = setting.then ?? (provider === 'claude' ? 'codex' : 'claude');
	return { provider: next, why: `${providerLabel[next]} preferred since ${when}` };
}
