/** Private health protocol between the supervisor and the exact worker it spawned. */
export interface PreviewHealth {
	protocol: 'harness-worker-v1';
	pid: number;
	errors: number;
	busy: boolean;
}
