import { createInterface } from 'node:readline/promises';

/** Keep the broker and Mac receipts alive across one operator-led device session. */
export async function runPhoneQualificationSession<Stage extends string>(
	stages: readonly Stage[],
	prove: (stage: Stage) => Promise<void>
) {
	const terminal = createInterface({ input: process.stdin, output: process.stdout });
	try {
		for (const stage of stages) {
			await terminal.question('Press Enter to publish the ' + stage + ' request. ');
			await prove(stage);
		}
		await terminal.question('After collecting the Mac receipts, press Enter to stop. ');
	} finally {
		terminal.close();
	}
}
