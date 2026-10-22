import type { HarnessCapture, HarnessRecord } from '../../models/explorer-ui/Harness.types';

type Scenario = HarnessRecord['scenarios'][number];
export type CaptureStanding = 'fresh' | 'inherited' | 'rejected' | 'unvalidated';

export interface CaptureProvenance {
	standing: CaptureStanding;
	/** Short statement of the standing, shown wherever the capture appears. */
	label: string;
	facts: Array<{ label: string; value: string }>;
	/** The same facts as sentences, with complete revisions. */
	note: string;
}

const brief = (id: string) => id.slice(0, 12);
const short = (commit: string) => commit.slice(0, 7);
const kinds: Record<string, string> = {
	fixture: 'fixture data, not a capture of running software',
	'actual-capture': 'actual capture of running software'
};

/** A screenshot always shows running software; audio does only when it says it is a capture. */
function needsStamp(capture: HarnessCapture): boolean {
	return capture.kind === 'screenshot' || capture.provenance === 'actual-capture';
}

function standingOf(record: HarnessRecord, scenario: Scenario, capture: HarnessCapture) {
	if (!record.valid) return 'unvalidated' as const;
	if (capture.status === 'failed') return 'rejected' as const;
	return scenario.inherited ? ('inherited' as const) : ('fresh' as const);
}

function labelOf(standing: CaptureStanding, scenario: Scenario, capture: HarnessCapture): string {
	if (standing === 'unvalidated') return 'Unvalidated capture';
	if (standing === 'inherited') return 'Inherited capture';
	if (standing === 'fresh') return 'Fresh capture';
	const actual = capture.server?.revision;
	if (actual && actual !== scenario.testedRevision) return 'Rejected capture from another revision';
	return !actual && needsStamp(capture)
		? 'Rejected capture with no recorded build'
		: 'Rejected capture';
}

/** What the record says about the capture, in one sentence that never credits the target wrongly. */
function verdict(
	standing: CaptureStanding,
	record: HarnessRecord,
	scenario: Scenario,
	stamped: boolean
) {
	const target = record.source.commit;
	const id = brief(record.id);
	if (standing === 'unvalidated') {
		return `Record ${id} could not be validated, so this proves nothing about revision ${target}.`;
	}
	if (standing === 'rejected') {
		return `Rejected by record ${id}, which targeted revision ${target}; the record's failures say why.`;
	}
	if (standing === 'inherited') {
		const { origin } = scenario;
		return `Inherited unchanged from record ${brief(origin.record)} of revision ${origin.commit}; not captured again for revision ${target}.`;
	}
	if (record.status === 'failed') {
		return `Accepted on its own, but record ${id} failed for revision ${target}.`;
	}
	return stamped
		? `Tested at ${short(target)} by passing record ${id}.`
		: `Produced while record ${id} verified revision ${target}.`;
}

/**
 * Says what really produced one recorded capture: the build and revision the capture itself
 * names, the record it was inherited from, and the verification attempt it is attached to. The
 * targeted revision is never presented as the capture's source.
 */
export function captureProvenance(
	record: HarnessRecord,
	scenario: Scenario,
	capture: HarnessCapture
): CaptureProvenance {
	const standing = standingOf(record, scenario, capture);
	const label = labelOf(standing, scenario, capture);
	const { server } = capture;
	const kind = capture.provenance ? (kinds[capture.provenance] ?? capture.provenance) : '';
	const outcome = record.valid ? record.status : 'not validated';
	const facts = [
		{ label: 'Standing', value: label },
		{
			label: 'Captured from',
			value: server
				? `build ${server.buildId} of ${brief(server.revision)}`
				: 'not recorded: the capture names no build or revision'
		},
		...(kind ? [{ label: 'Provenance', value: kind }] : []),
		...(scenario.inherited
			? [
					{
						label: 'Inherited from',
						value: `record ${brief(scenario.origin.record)} of ${brief(scenario.origin.commit)}`
					}
				]
			: []),
		{
			label: 'Verification attempt',
			value: `record ${brief(record.id)} (${outcome}) targeting ${brief(record.source.commit)}`
		}
	];
	const source = server
		? `Captured from build ${server.buildId} of revision ${server.revision}.`
		: 'The capture does not record which build or revision produced it.';
	const note = [
		source,
		kind ? `Provenance: ${kind}.` : '',
		verdict(standing, record, scenario, Boolean(server))
	];
	return { standing, label, facts, note: note.filter(Boolean).join(' ') };
}

/** Where a scenario's result comes from; a failed attempt is never called tested. */
export function scenarioOrigin(scenario: Scenario): string {
	if (scenario.inherited) return `Inherited from ${short(scenario.origin.commit)}`;
	if (scenario.status === 'passed') return `Tested at ${short(scenario.testedRevision)}`;
	const builds = scenario.states.flatMap((state) =>
		state.captures.map((capture) => capture.server?.revision)
	);
	const others = [...new Set(builds)].filter(
		(revision): revision is string => Boolean(revision) && revision !== scenario.testedRevision
	);
	const elsewhere = others.length ? `; captures came from ${others.map(short).join(', ')}` : '';
	return `Failed attempt at ${short(scenario.testedRevision)}${elsewhere}`;
}
