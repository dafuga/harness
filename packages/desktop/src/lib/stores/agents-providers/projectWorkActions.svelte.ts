export function createProjectWorkActionsStore(initialValue = '') {
	let value = $state(initialValue);

	return {
		get value(): string {
			return value;
		},
		set value(nextValue: string) {
			value = nextValue;
		}
	};
}
