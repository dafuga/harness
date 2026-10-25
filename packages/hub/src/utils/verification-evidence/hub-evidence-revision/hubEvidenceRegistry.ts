import { hubModuleData, hubRequiresModuleData } from '../../development-tooling/hubModuleData';
import { scenarioManifestSchema } from '../../../../../../src/core/unitTypes';
import { budgetEventSchema, type BudgetEvent } from '../../../../../../src/core/budgetTypes';
import { budgetsLedger } from '../../../../../../src/core/unitsConfig';
import { BudgetService } from '../../../../../../src/services/budget-service/BudgetService';
import { revisionRegistry } from '../../../../../../src/utils/revision-registry/revisionRegistry';
import { hubRecords } from '../../development-tooling/hubRecords';
import { hubRead, type HubSourceContext } from '../../development-tooling/hubSource';
import { hubJson, hubFail } from '../../development-tooling/hubJson';

export async function hubEvidenceRegistry(context: HubSourceContext) {
	if (hubRequiresModuleData(context)) return (await hubModuleData(context, true)).registry;
	const units = await hubRecords(context);
	const entries = context.entries.filter((e) =>
		/^specification\/scenarios\/[^/]+\.json$/.test(e.path)
	);
	const scenarios = await Promise.all(
		entries.map(async (e) => {
			const parsed = scenarioManifestSchema.safeParse(hubJson(await hubRead(context, e.path)));
			if (!parsed.success || e.path !== `specification/scenarios/${parsed.data.id}.json`)
				return hubFail();
			return parsed.data;
		})
	);
	const events: BudgetEvent[] = [];
	if (context.entries.some((e) => e.path === budgetsLedger)) {
		const text = new TextDecoder('utf-8', { fatal: true }).decode(
			await hubRead(context, budgetsLedger)
		);
		for (const line of text.split('\n').filter((line) => line.trim())) {
			const parsed = budgetEventSchema.safeParse(JSON.parse(line));
			if (!parsed.success) return hubFail();
			events.push(parsed.data);
		}
	}
	const blobs = new Map(
		context.entries.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha])
	);
	return revisionRegistry(units, scenarios, blobs, new BudgetService().baselines(events, units));
}
