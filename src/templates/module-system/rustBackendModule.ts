import type { ModuleDefinition } from '../../services/module-system/moduleDefinition.types';
export const rustBackendModule: ModuleDefinition = {
	schemaVersion: 1,
	id: 'rust-backend',
	version: '1.0.0',
	title: 'Rust Backend',
	description: 'Native Rust HTTP services with Axum, typed JSON and focused Cargo tests.',
	instructions: [
		'Generate a backend resource, then run bun run check:rust-backend <name>, bun run build:rust-backend <name> and bun run rust:backend <name>. Run cargo test --manifest-path src/services/rust-backend/<name>/Cargo.toml directly if preferred. Commit Cargo.lock.',
		'Each resource is an independent Cargo package with an explicit workspace boundary, so it also works inside a repository that already has a Cargo workspace.',
		'The example listens on 127.0.0.1:3001; PORT selects another port. It exposes GET /health and a bounded POST /run JSON operation.',
		'Keep application authentication, authorization, persistence and deployment in the application boundary. Configure your normal reverse proxy and process supervisor before exposing a backend.',
		'Use browser Rust WebAssembly for browser computation; this module produces a native server executable and does not run in the browser.'
	],
	dependencies: {},
	packageScripts: {
		'rust:backend': 'node src/services/rust-backend/rustBackend.mjs run',
		'build:rust-backend': 'node src/services/rust-backend/rustBackend.mjs build',
		'check:rust-backend': 'node src/services/rust-backend/rustBackend.mjs test'
	},
	setup: [
		{
			path: 'src/services/rust-backend/rustBackend.mjs',
			contents:
				"import { spawnSync } from 'node:child_process';\nconst [mode, name] = process.argv.slice(2);\nif (!['run', 'build', 'test'].includes(mode) || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name ?? '')) throw new Error('Pass run, build or test and a generated kebab-case backend name.');\nconst result = spawnSync('cargo', [mode, '--manifest-path', `src/services/rust-backend/${name}/Cargo.toml`, '--target-dir', `.cache/rust-backend/${name}`], { stdio: 'inherit' });\nif (result.error) throw result.error;\nprocess.exit(result.status ?? 1);\n"
		}
	],
	resources: [
		{
			id: 'kernel',
			title: 'Rust backends',
			singular: 'Rust backend',
			kind: 'rust-backend',
			instructions: [
				'Replace the example calculation with the backend responsibility; retain bounded input, typed responses, loopback defaults and HTTP tests.'
			],
			files: [
				{
					path: 'src/services/rust-backend/{{kebabName}}/Cargo.toml',
					contents:
						'[package]\nname = "{{kebabName}}"\nversion = "0.1.0"\nedition = "2024"\nrust-version = "1.85"\n[workspace]\n[dependencies]\naxum = "=0.8.9"\ntokio = { version = "1", features = ["macros", "rt", "net", "signal"] }\nserde = { version = "1", features = ["derive"] }\n[dev-dependencies]\ntower = { version = "0.5", features = ["util"] }\n'
				},
				{
					path: 'src/services/rust-backend/{{kebabName}}/src/main.rs',
					contents:
						'#[tokio::main(flavor = "current_thread")]\nasync fn main() -> Result<(), Box<dyn std::error::Error>> {\n    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string()).parse()?;\n    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port)).await?;\n    println!("LISTENING http://{}", listener.local_addr()?);\n    axum::serve(listener, {{snakeName}}::app())\n        .with_graceful_shutdown(async { let _ = tokio::signal::ctrl_c().await; })\n        .await?;\n    Ok(())\n}\n'
				},
				{
					path: 'src/services/rust-backend/{{kebabName}}/src/lib.rs',
					contents:
						'mod service;\nmod types;\nuse axum::{extract::DefaultBodyLimit, routing::{get, post}, Json, Router, http::StatusCode};\nuse types::{CalculationInput, CalculationOutput};\npub fn app() -> Router {\n    Router::new().route("/health", get(|| async { "ok" }))\n        .route("/run", post(run)).layer(DefaultBodyLimit::max(16 * 1024))\n}\nasync fn run(Json(input): Json<CalculationInput>) -> Result<Json<CalculationOutput>, StatusCode> {\n    service::calculate(input.limit).map(|total| Json(CalculationOutput { total })).ok_or(StatusCode::BAD_REQUEST)\n}\n'
				},
				{
					path: 'src/services/rust-backend/{{kebabName}}/src/service.rs',
					contents:
						'pub fn calculate(limit: u32) -> Option<f64> {\n    if limit > 1_000_000 { return None; }\n    Some((0..limit).map(|value| f64::from(value).powi(2)).sum())\n}\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn bounded_calculation() {\n        assert_eq!(super::calculate(4), Some(14.0));\n        assert_eq!(super::calculate(0), Some(0.0));\n        assert_eq!(super::calculate(1_000_001), None);\n    }\n}\n'
				},
				{
					path: 'src/services/rust-backend/{{kebabName}}/src/types.rs',
					contents:
						'#[derive(serde::Deserialize)]\npub struct CalculationInput { pub limit: u32 }\n#[derive(serde::Serialize)]\npub struct CalculationOutput { pub total: f64 }\n'
				},
				{
					path: 'src/services/rust-backend/{{kebabName}}/tests/api.rs',
					contents:
						'use axum::{body::Body, http::{Request, StatusCode}};\nuse tower::ServiceExt;\n#[tokio::test]\nasync fn router_keeps_health_and_rejects_invalid_work() {\n    let response = {{snakeName}}::app().oneshot(Request::get("/health").body(Body::empty()).unwrap()).await.unwrap();\n    assert_eq!(response.status(), StatusCode::OK);\n    let response = {{snakeName}}::app().oneshot(Request::post("/run").header("content-type", "application/json")\n        .body(Body::from(r#"{"limit":1000001}"#)).unwrap()).await.unwrap();\n    assert_eq!(response.status(), StatusCode::BAD_REQUEST);\n}\n'
				}
			]
		}
	]
};
