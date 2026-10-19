import { ReasonUse, ReasonKind, uses, alike } from '../../../utils/entityReasons';


/** The uses of one attempt by kind and outcome, every subject under the outcome it had. */
export function reasonUses(
	uses: ReasonUse[]
): Array<{ kind: ReasonKind; outcome: string; subjects: string[] }> {
	const said = uses.map((use) => ({ text: `${use.kind} ${use.outcome}`, of: use }));
	return alike(said).map(({ of }) => ({
		kind: of[0].kind,
		outcome: of[0].outcome,
		subjects: of.map((use) => use.subject)
	}));
}
