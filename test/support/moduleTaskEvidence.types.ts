/** The parts of a module task fixture that reviewer evidence needs. */
export interface EvidenceFixture {
	root: string;
	git: { run(args: string[]): Promise<string> };
}
