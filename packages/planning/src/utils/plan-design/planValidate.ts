import { fail } from "../planData";

export function version(value: string): void {
	if (!/^v\d{3,}$/.test(value)) fail('invalid-input', 'Invalid design version');
}
