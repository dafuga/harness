// @harness-uid u_nz6sw6sbnv
// @harness-uid u_h0m3ask0p1
import { sanitizeText } from '../project-overview/projectOverviewPrivacy';
import type { HomeAgent, HomeAskConfirm, HomeAskInput, HomeAskOption } from './hubHome.types';

const confirmKinds: readonly HomeAskConfirm[] = ['deploy', 'money', 'secret'];

/** The tracker's choices for an ask, cleaned for display. Anything malformed means no choices. */
export function readHomeAskOptions(value: HomeAskInput): HomeAskOption[] {
	if (!Array.isArray(value) || value.length < 2 || value.length > 4) return [];
	const options = value.map(readOption);
	if (options.some((option) => option === null)) return [];
	const list = options as HomeAskOption[];
	return list.filter((option) => option.recommended).length > 1 ? [] : list;
}

function readOption(entry: unknown): HomeAskOption | null {
	if (typeof entry !== 'object' || entry === null) return null;
	const { label, effect, recommended } = entry as Record<string, unknown>;
	if (typeof label !== 'string' || !label.trim()) return null;
	return {
		label: sanitizeText(label.trim()).slice(0, 80),
		effect: typeof effect === 'string' ? sanitizeText(effect).slice(0, 400) : '',
		...(recommended === true && { recommended: true as const })
	};
}

export function readHomeAskConfirm(value: HomeAskInput): HomeAskConfirm | undefined {
	return confirmKinds.find((kind) => kind === value);
}

/** The choice fields an agent shows, only while its question is open and has two or more options. */
export function homeAskFields(
	item: { options?: HomeAskOption[]; confirm?: HomeAskConfirm } | undefined,
	question: string | null
): Pick<HomeAgent, 'options' | 'confirm'> {
	if (!question || !item?.options || item.options.length < 2) return {};
	return { options: item.options, ...(item.confirm && { confirm: item.confirm }) };
}
