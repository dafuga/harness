import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const temporaryDirectories = new Set<string>();
const projectPath = '/api/projects/11111111-1111-4111-8111-111111111111/snapshot';
const stateId = 'status-shows-all-public-account-states';
const requestStateId = 'request-returns-project-answers-and-clears-a-401-session';
const accountSources = [
	'../../ios/App/App/Remote/RemoteCoding.swift',
	'../../ios/App/App/Account/HubAccountHandoff.swift',
	'../../ios/App/App/Account/HubAccountHttp.swift',
	'../../ios/App/App/Account/HubAccountModels.swift',
	'../../ios/App/App/Account/HubAccountSession.swift',
	'../../ios/App/App/Account/HubAccountVault.swift'
].map((path) => fileURLToPath(new URL(path, import.meta.url)));

afterEach(() => {
	for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
	temporaryDirectories.clear();
});

const nativeRunner = String.raw`
import Foundation

final class CallbackBox<T> { var value: T? }
func awaitValue<T>(_ operation: (@escaping (T) -> Void) -> Void) -> T {
	let semaphore = DispatchSemaphore(value: 0)
	let box = CallbackBox<T>()
	operation { box.value = $0; semaphore.signal() }
	semaphore.wait()
	return box.value!
}

final class TemporaryAccountVault: HubAccountVault {
	private let file: URL
	init(_ folder: URL) {
		try! FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
		file = folder.appendingPathComponent("session.json")
	}
	func load() -> HubAccountCredential? {
		guard let data = try? Data(contentsOf: file) else { return nil }
		return try? JSONDecoder().decode(HubAccountCredential.self, from: data)
	}
	func save(_ credential: HubAccountCredential) throws {
		try JSONEncoder().encode(credential).write(to: file, options: .atomic)
	}
	func wipe() { try? FileManager.default.removeItem(at: file) }
}

final class FakeAccountHub: HubAccountTransport {
	let mode: String
	var projectCalls = 0
	init(_ mode: String) { self.mode = mode }
	func send(_ request: URLRequest, done: @escaping (Result<HubAccountReply, HubAccountFailure>) -> Void) {
		let path = request.url?.path ?? ""
		if path == "/api/auth/status" {
			let actor: [String: Any] = ["id": "109876543210987654321", "name": "Alex Morgan",
				"email": "alex.morgan@example.com", "emailVerified": true]
			let body: [String: Any] = mode == "signed-in"
				? ["configured": true, "actor": actor]
				: ["configured": true]
			done(.success(HubAccountReply(status: 200, contentType: "application/json",
				data: RemoteCoding.json(body) ?? Data())))
			return
		}
		if path == "/api/auth/native/start" {
			let id = String(repeating: "h", count: 43)
			let now = ISO8601DateFormatter().date(from: "2026-11-15T18:00:00Z")!
			let answer: [String: Any] = ["handoffId": id, "userCode": "K8M-2Q", "interval": 5,
				"verificationUrl": "https://hub.example.invalid/native/\(id)",
				"expiresAt": ISO8601DateFormatter().string(from: now.addingTimeInterval(300))]
			done(.success(HubAccountReply(status: 200, contentType: "application/json",
				data: RemoteCoding.json(answer) ?? Data())))
			return
		}
		if mode == "request" && path == "/api/projects/11111111-1111-4111-8111-111111111111/snapshot" {
			projectCalls += 1
			let reply = projectCalls == 1
				? HubAccountReply(status: 200, contentType: "application/json", data: Data("{\"ok\":true}".utf8))
				: HubAccountReply(status: 401, contentType: "application/json",
					data: Data("{\"error\":\"session-required\"}".utf8))
			done(.success(reply))
			return
		}
		done(.failure(.offline))
	}
}

let origin = URL(string: "https://hub.example.invalid")!
let fixedNow = ISO8601DateFormatter().date(from: "2026-11-15T18:00:00Z")!
let actorId = "109876543210987654321"
let token = "fixture-private-session-token"
func makeSession(_ mode: String, _ folder: URL) -> (HubAccountSession, FakeAccountHub) {
	let vault = TemporaryAccountVault(folder)
	if mode == "signed-in" || mode == "request" {
		try! vault.save(HubAccountCredential(origin: origin.absoluteString, subject: actorId, name: "Alex Morgan",
			email: "alex.morgan@example.com", token: token, expiresAt: fixedNow.addingTimeInterval(3600)))
	}
	let hub = FakeAccountHub(mode)
	let session = HubAccountSession(origin: origin, vault: vault, transport: hub)
	session.now = { fixedNow }
	return (session, hub)
}
func accountStatus(_ session: HubAccountSession) -> [String: Any] {
	let result: Result<[String: Any], HubAccountFailure> = awaitValue { session.status($0) }
	return try! result.get()
}
func connect(_ session: HubAccountSession) {
	let result: Result<[String: Any], HubAccountFailure> = awaitValue { session.connect($0) }
	_ = try! result.get()
}
func projectReply(_ session: HubAccountSession) -> [String: Any] {
	let call = HubAccountCall(method: "GET", path: "/api/projects/11111111-1111-4111-8111-111111111111/snapshot")
	let result: Result<HubAccountReply, HubAccountFailure> = awaitValue { session.request(call, $0) }
	return try! result.get().object
}
func json(_ value: Any) -> String {
	String(data: RemoteCoding.json(value)!, encoding: .utf8)!
}

let mode = CommandLine.arguments[2]
let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
var output: [String: Any]
if mode == "status" {
	let (signedOutSession, _) = makeSession("signed-out", root.appendingPathComponent("signed-out"))
	let signedOut = accountStatus(signedOutSession)
	let (pendingSession, _) = makeSession("pending", root.appendingPathComponent("pending"))
	connect(pendingSession)
	let pending = accountStatus(pendingSession)
	let (signedInSession, _) = makeSession("signed-in", root.appendingPathComponent("signed-in"))
	let signedIn = accountStatus(signedInSession)
	output = ["signedOut": signedOut, "pending": pending, "signedIn": signedIn]
} else {
	let (session, _) = makeSession("request", root.appendingPathComponent("request"))
	let success = projectReply(session)
	let unauthorized = projectReply(session)
	let afterUnauthorized = accountStatus(session)
	output = ["success": success, "unauthorized": unauthorized, "afterUnauthorized": afterUnauthorized]
}
print(json(output))
`;

function nativeAccountResult(mode: 'status' | 'request'): Record<string, unknown> {
	const directory = mkdtempSync(join(tmpdir(), 'harness-ios-account-'));
	temporaryDirectories.add(directory);
	const source = join(directory, 'main.swift');
	const executable = join(directory, 'account-example');
	writeFileSync(source, nativeRunner);
	execFileSync('xcrun', [
		'swiftc',
		'-module-cache-path',
		join(directory, 'modules'),
		...accountSources,
		source,
		'-o',
		executable
	], { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] });
	const result = execFileSync(executable, [directory, mode], {
		encoding: 'utf8',
		timeout: 2_000,
		stdio: ['ignore', 'pipe', 'pipe']
	});
	return JSON.parse(result) as Record<string, unknown>;
}

test('status shows all public account states', () => {
	const result = nativeAccountResult('status');
	const signedOut = result.signedOut;
	const pending = result.pending as { handoff: Record<string, unknown> };
	const signedIn = result.signedIn;
	expect(signedOut).toEqual({ configured: true, state: 'signed-out' });
	expect(pending).toMatchObject({ configured: true, state: 'pending', handoff: {
		userCode: 'K8M-2Q', verificationUrl: `https://hub.example.invalid/native/${'h'.repeat(43)}`,
		expiresAt: '2026-11-15T18:05:00Z', interval: 5
	} });
	expect(signedIn).toEqual({ configured: true, state: 'signed-in', actor: {
		id: '109876543210987654321', name: 'Alex Morgan', email: 'alex.morgan@example.com'
	} });
	expect(JSON.stringify(result)).not.toContain('fixture-private-session-token');
	recordExampleCases({ unitId: 'desktop.adapter.ios-account', symbol: 'status', state: stateId,
		evidence: 'examples-cases', file: `${stateId}.json` }, [
		{ name: 'no stored account', input: {}, output: signedOut },
		{ name: 'approval is pending', input: {}, output: result.pending },
		{ name: 'verified Google account', input: {}, output: signedIn }
	]);
}, 20_000);

test('request returns project answers and clears a 401 session', () => {
	const result = nativeAccountResult('request') as {
		success: { status: number; contentType: string; data: string };
		unauthorized: { status: number; contentType: string; data: string }; afterUnauthorized: unknown;
	};
	expect(result.success).toEqual({ status: 200, contentType: 'application/json', data: Buffer.from('{"ok":true}').toString('base64') });
	expect(result.unauthorized).toEqual({ status: 401, contentType: 'application/json', data: Buffer.from('{"error":"session-required"}').toString('base64') });
	expect(result.afterUnauthorized).toEqual({ configured: true, state: 'signed-out' });
	recordExampleCases({ unitId: 'desktop.adapter.ios-account', symbol: 'request', state: requestStateId,
		evidence: 'examples-cases', file: `${requestStateId}.json` }, [{
		name: 'read a project snapshot and handle the expired session',
		input: { method: 'GET', path: projectPath }, output: result
	}]);
}, 20_000);
