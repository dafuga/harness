import { expect, test, vi, afterEach } from 'vitest';
import { connectDecart } from '../../src/adapters/agents-providers/DecartStreamAdapter';
const mocked = vi.hoisted(() => ({ connect: vi.fn() }));
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

test('preview cap disconnects once and stops source/output tracks without automatic retries', async () => {
	vi.useFakeTimers();
	const document = new EventTarget();
	Object.defineProperty(document, 'hidden', { value: false, writable: true });
	vi.stubGlobal('document', document);
	const sourceStop = vi.fn(),
		outputStop = vi.fn(),
		disconnect = vi.fn();
	const source = { getTracks: () => [{ stop: sourceStop }] },
		output = { getTracks: () => [{ stop: outputStop }] };
	mocked.connect.mockImplementation(async (_source, options) => {
		options.onRemoteStream(output);
		return { disconnect, on: vi.fn() };
	});
	const canvas = { captureStream: () => source } as unknown as HTMLCanvasElement;
	const session = {
		apiKey: 'ephemeral-test',
		expiresAt: '2099-01-01',
		model: 'lucy-restyle-2' as const,
		fast: false,
		seconds: 60,
		rate: 0.01
	};
	await connectDecart(canvas, session, { prompt: 'garden', connector: mocked.connect }, vi.fn());
	expect(mocked.connect).toHaveBeenCalledWith(
		source,
		expect.objectContaining({ retries: 0, capacityRetryBudgetMs: 0 })
	);
	await vi.advanceTimersByTimeAsync(60000);
	expect(disconnect).toHaveBeenCalledTimes(1);
	expect(sourceStop).toHaveBeenCalled();
	expect(outputStop).toHaveBeenCalled();
	expect(mocked.connect).toHaveBeenCalledTimes(1);
});

test('hidden documents stop connections that finish after cancellation', async () => {
	vi.useFakeTimers();
	const document = new EventTarget();
	Object.defineProperty(document, 'hidden', { value: true });
	vi.stubGlobal('document', document);
	let finish: (value: unknown) => void = () => {};
	const disconnect = vi.fn(),
		stop = vi.fn();
	mocked.connect.mockReturnValue(
		new Promise((resolve) => {
			finish = resolve;
		})
	);
	const pending = connectDecart(
		{ captureStream: () => ({ getTracks: () => [{ stop }] }) } as unknown as HTMLCanvasElement,
		{
			apiKey: 'ephemeral-test',
			expiresAt: '2099-01-01',
			model: 'lucy-2.5',
			fast: false,
			seconds: 60,
			rate: 0.02
		},
		{ prompt: 'garden', connector: mocked.connect },
		vi.fn()
	);
	document.dispatchEvent(new Event('visibilitychange'));
	finish({ disconnect, on: vi.fn() });
	await pending;
	expect(disconnect).toHaveBeenCalled();
	expect(stop).toHaveBeenCalled();
});

test('the unconfigured live path refuses before capture or network access', async () => {
	const captureStream = vi.fn();
	await expect(
		connectDecart(
			{ captureStream } as unknown as HTMLCanvasElement,
			{
				apiKey: 'unused',
				expiresAt: '2099',
				model: 'lucy-2.5',
				fast: false,
				seconds: 60,
				rate: 0.02
			},
			'garden',
			vi.fn()
		)
	).rejects.toThrow('credential-safe');
	expect(captureStream).not.toHaveBeenCalled();
	expect(mocked.connect).not.toHaveBeenCalled();
});
