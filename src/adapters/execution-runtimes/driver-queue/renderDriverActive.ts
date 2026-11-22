// @harness-uid u_rel4hbjk7q
import type { DriverActive } from '../DriverQueueAdapter.types';
/** @pure Mirrors the live ACTIVE.md table without rewriting the driver snapshot. */
export function renderDriverActive(state: DriverActive): string {
	const c = state.counts,
		t = state.totals,
		r = state.reverify_totals;
	const lines = [
		`# Active jobs (${state.updated} Lisbon)`,
		'',
		`**Luna ${c.luna} · Haiku ${c.haiku} · total ${c.total}** (+ ${c.reverify} re-verify gate runs). Done ${t.done} (pass ${t.pass}, fail ${t.fail}), remaining ${t.remaining} of ${t.planned} planned.`,
		`Re-verify: done ${r.done} (pass ${r.pass}, fail ${r.fail}), remaining ${r.remaining} of ${r.planned}.`,
		'',
		'| Model | Kind | Unit | Task | Slot | PID | Started |',
		'|---|---|---|---|---|---:|---|'
	];
	for (const j of [...state.active].sort(
		(a, b) => a.model.localeCompare(b.model) || String(a.slot).localeCompare(String(b.slot))
	))
		lines.push(
			`| ${j.model} | ${j.kind ?? 'job'} | ${j.unit ?? ''} | ${j.task} | ${j.slot ?? ''} | ${j.pid ?? ''} | ${j.started ?? ''} |`
		);
	return lines.join('\n') + '\n';
}
