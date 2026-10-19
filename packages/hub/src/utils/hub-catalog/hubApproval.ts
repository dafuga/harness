import type { HubSourceContext } from '../hubSource';
import { hubRead } from '../hubSource';
import { hubJson } from '../hubJson';
import { hubSchemas, hubApprovalSchema } from '../hubSchemas';
import type { HubApproval, HubPlan, HubDesign } from '../hubSchemas';

function bindings(images: { file: string; sha256: string }[]) {
	return JSON.stringify(
		images
			.map(({ file, sha256 }) => ({ file, sha256 }))
			.sort((a, b) => a.file.localeCompare(b.file))
	);
}

/** What an approval of a version binds: its one named option, or every image of a single design. */
function approvable(value: HubDesign, option: string | undefined) {
	if (!value.options) return option === undefined ? value.images : null;
	return value.options.find((item) => item.id === option)?.images ?? null;
}

/** A record approves the version only for exactly the images it may bind, under the same contract. */
function matches(record: HubApproval, plan: HubPlan, value: HubDesign): boolean {
	const bound = approvable(value, record.option);
	if (!bound || record.unitId !== plan.unitId || record.version !== value.version) return false;
	const notes = record.notesSha256 === (value.notes?.sha256 ?? null);
	return (
		notes &&
		record.contractHash === value.contractHash &&
		bindings(record.images) === bindings(bound)
	);
}

export async function hubApproval(context: HubSourceContext, plan: HubPlan, value: HubDesign) {
	const approvals = await Promise.all(
		context.entries
			.filter(
				(e) => e.path.startsWith(`${plan.path}/designs/approvals/`) && e.path.endsWith('.json')
			)
			.map(async (e) => hubSchemas(hubApprovalSchema, hubJson(await hubRead(context, e.path))))
	);
	return approvals
		.filter((record) => matches(record, plan, value))
		.sort((a, b) => a.approvedAt.localeCompare(b.approvedAt))
		.at(-1);
}
