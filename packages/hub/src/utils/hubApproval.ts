import type { HubSourceContext } from './hubSource';
import { hubRead } from './hubSource';
import { hubJson } from './hubJson';
import { hubSchemas, hubApprovalSchema } from './hubSchemas';
import type { HubPlan, HubDesign } from './hubSchemas';
function bindings(images: { file: string; sha256: string }[]) {
	return JSON.stringify(
		images
			.map(({ file, sha256 }) => ({ file, sha256 }))
			.sort((a, b) => a.file.localeCompare(b.file))
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
		.filter(
			(a) =>
				a.unitId === plan.unitId &&
				a.version === value.version &&
				a.contractHash === value.contractHash &&
				a.notesSha256 === (value.notes?.sha256 ?? null) &&
				bindings(a.images) === bindings(value.images)
		)
		.sort((a, b) => a.approvedAt.localeCompare(b.approvedAt))
		.at(-1);
}
