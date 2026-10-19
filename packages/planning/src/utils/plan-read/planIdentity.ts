import { identity, attest } from '../planIdentity';
import type { Git } from "../planGit";
import { fail } from "../planData";
import { planValidate } from "../planValidate";
import type { PlanSummary } from "../../models/Planning.types.ts";

export async function validateIdentity(git: Git, rev: string, plan: PlanSummary): Promise<void> {
	identity(plan.unitId);
	if (plan.path !== planValidate(`${plan.category}.${plan.slug}`))
		fail('artifact-tampered', 'Plan folder mismatch');
	if (plan.unitId !== `${plan.category}.${plan.slug}`) await attest(git, rev, plan);
}
