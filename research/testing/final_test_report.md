# PSDE Complete Testing and Validation Report

Date: 2026-10-13

## Scope and environment

Testing used synthetic data only. Existing datasets and research results were not
deleted or overwritten. The live validation used:

- Frontend: Vite/React application at `http://localhost:5173`
- Backend: FastAPI/Uvicorn on `http://127.0.0.1:8004`
- Database: backend SQLite database configured by `backend/.env`
- Blockchain: local Hardhat JSON-RPC at `http://127.0.0.1:8545`
- Chain ID: `31337`
- Contract: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- Python: 3.11.9 in `backend/.venv`

## Commands executed

### Available automated commands

```text
npm --prefix frontend run build
npm --prefix frontend run lint
backend\.venv\Scripts\python.exe -m pytest -q backend\tests
backend\.venv\Scripts\python.exe -m compileall -q backend\app
npm --prefix blockchain run compile
npm --prefix blockchain test
npm --prefix blockchain run node -- --hostname 127.0.0.1
npm --prefix blockchain run deploy
backend\.venv\Scripts\python.exe scripts\generate_dataset.py --size <10|100|1000|10000> --seed 42 --output research\testing\datasets
backend\.venv\Scripts\python.exe benchmarks\run.py --dataset <D10|D100|D1000|D10000> --seed 42
```

### Live API checks

The live checks exercised health, authentication, case CRUD, evidence upload,
integrity verification, Merkle commitment/proof, disclosure, audit, dashboard,
blockchain anchoring, tampering, invalid proofs, wrong versions, invalid input,
unauthenticated access, and cleanup.

## Component results

| Component | Result | Evidence |
|---|---|---|
| Frontend TypeScript/Vite build | PASS | Production build completed; all route chunks emitted |
| Frontend navigation/forms/API smoke | PASS | Live authenticated case creation and deletion completed |
| Frontend lint | BLOCKED | ESLint 9 reported no `frontend/eslint.config.js`, `.mjs`, or `.cjs` |
| Backend Python syntax | PASS | `compileall` completed without errors |
| Backend automated tests | NOT IMPLEMENTED | `backend/tests` contains no test files; pytest ran 0 tests |
| Backend API health | PASS | `GET /health` returned 200 |
| Authentication | PASS | Authenticated requests succeeded; unauthenticated `GET /cases` returned 403 |
| Input validation | PASS | Invalid case payload returned 422; nonexistent case returned 404 |
| Case/database CRUD | PASS | Create returned 201; delete returned 204; final list returned `[]` |
| Evidence ingestion | PASS | Synthetic text artifact accepted with metadata and stored hash |
| SHA-256 integrity | PASS | Expected and actual hashes matched |
| PII/sensitivity/relevance classification | PASS (smoke) | Synthetic artifact was classified PUBLIC/IRRELEVANT with PII findings empty |
| Privacy policy/access decision | PASS | Disclosure response included decision and disclosure items; excessive filter was denied |
| Merkle root generation | PASS | Commitment returned root, version 1, and artifact IDs |
| Merkle proof generation | PASS | Inclusion proof endpoint returned proof metadata |
| Merkle proof verification | PASS | Original evidence returned `VERIFIED` |
| Evidence tamper detection | PASS | Modified bytes returned `HASH_MISMATCH` |
| Invalid Merkle proof | PASS | Altered proof returned `MERKLE_MISMATCH` |
| Wrong dataset version | PASS | Version 999 returned `COMMITMENT_NOT_FOUND` |
| Blockchain node/deployment | PASS | Hardhat node started; contract deployed at configured address |
| Blockchain registration | PASS | Transaction succeeded; block 2; gas 141622 |
| Blockchain retrieval API | NOT IMPLEMENTED | No public `/blockchain/{case_id}/commitment/{version}` route exists |
| Selective disclosure serialization | FIXED/PASS | Initial live test found ORM serialization 500; eager relationship refresh fixed it; retest returned 201 |
| Audit/chain of custody | PASS | Case/evidence/commitment/verification/disclosure audit events were returned |
| Dashboard aggregation | PASS (smoke) | Dashboard returned zero-state and updated aggregate fields during live workflows |
| Verification of modified evidence | PASS | Verification failed before Merkle processing on hash mismatch |
| Role matrix/access-bypass testing | PARTIAL | Admin authorization and unauthenticated bypass tested; all role permutations not available in automated tests |
| Benchmarking | EXECUTED / NOT VALIDATED | Commands ran, but implementation uses `sleep()` and hard-coded metrics rather than measured PSDE processing |
| Benchmark graphs | NOT IMPLEMENTED | No graph/report-generation implementation was found |

## Live end-to-end workflow

The final live workflow used fictional evidence and completed:

1. Created a synthetic case.
2. Uploaded synthetic evidence.
3. Calculated and verified SHA-256.
4. Classified evidence and applied privacy policy.
5. Generated a Merkle commitment and inclusion proof.
6. Registered the commitment on the local Hardhat blockchain.
7. Created a selective disclosure package.
8. Retrieved the audit trail.
9. Verified original evidence successfully.
10. Verified modified evidence failed with `HASH_MISMATCH`.
11. Deleted the temporary case and confirmed the final case list was empty.

## Security and regression results

| Check | Expected behavior | Result |
|---|---|---|
| Missing bearer token | Reject access | PASS: 403 |
| Invalid case identifier | Not found | PASS: 404 |
| Invalid case fields | Validation error | PASS: 422 |
| Modified evidence bytes | Reject | PASS: `HASH_MISMATCH` |
| Invalid Merkle proof | Reject | PASS: `MERKLE_MISMATCH` |
| Incorrect version | Reject | PASS: `COMMITMENT_NOT_FOUND` |
| Excessive disclosure request | Deny in policy | PASS: disclosure decision DENY |
| Case deletion with dependents | Delete safely | PASS: HTTP 204 and no remaining cases |
| Blockchain unavailable | Explicit service error | PASS: HTTP 503 before Hardhat was started |

## Bug fixed during testing

`backend/app/api/disclosure.py` returned a SQLAlchemy `DisclosureRequest`
relationship before its `items` collection was loaded. The live endpoint raised:

```text
TypeError: Object of type DisclosureRequest is not JSON serializable
```

The route now refreshes the `items` relationship before converting to
`DisclosureRequestOut`. A live retest returned HTTP 201 with a complete
disclosure response.

## Benchmark execution

Synthetic datasets were generated with seed 42 at:

- `research/testing/datasets/D10_seed42`
- `research/testing/datasets/D100_seed42`
- `research/testing/datasets/D1000_seed42`
- `research/testing/datasets/D10000_seed42`

Raw benchmark JSON files were produced at:

- `benchmarks/results/benchmark_D10_42_1791839933.json`
- `benchmarks/results/benchmark_D100_42_1791839835.json`
- `benchmarks/results/benchmark_D1000_42_1791839856.json`
- `benchmarks/results/benchmark_D10000_42_1791840024.json`

The benchmark runner reports timing-like values, but its source
(`benchmarks/run.py`) explicitly uses `time.sleep()` and hard-coded privacy,
classification, verification, and tampering metrics. These results must not be
presented as measured PSDE performance. Therefore comparative full disclosure,
hash-only, selective-without-blockchain, and proposed-system measurements are
**NOT IMPLEMENTED**, and no graph was generated from fabricated measurements.

Observed runner output included:

| Dataset | Hash time reported | Merkle time reported | Disclosure time reported | Memory reported |
|---|---:|---:|---:|---:|
| D10 | 20.515 ms | 10.506 ms | 10.000 ms | 28.008 MB |
| D100 | 200.650 ms | 100.366 ms | 100.000 ms | 27.891 MB |
| D1000 | 2006.070 ms | 1000.476 ms | 1000.000 ms | 27.004 MB |
| D10000 | 20000.751 ms | 10000.303 ms | 10000.000 ms | 27.355 MB |

## Test counts

- PASS: 22 component/security/live checks
- FIXED then PASS: 1 disclosure serialization defect
- BLOCKED: 1 frontend lint command
- PARTIAL: 2 smoke-only areas (privacy classification and role matrix)
- NOT IMPLEMENTED: automated backend tests, smart-contract tests, blockchain retrieval API, measured comparative benchmarks, CSV/graph generation

Counts are classification counts for this report, not claims about test-case
coverage where the repository has no test suite.

## Known limitations and reproduction

1. Add an ESLint 9 flat configuration under `frontend/` before treating lint as
   passing.
2. Add backend and Hardhat test files; both current suites contain zero tests.
3. Replace the simulated benchmark runner with actual implementations for each
   comparison method, then generate CSV and graphs from measured runs.
4. Add a public blockchain commitment retrieval route if that API surface is
   required.
5. The local Hardhat chain is ephemeral and must not be treated as a public or
   production blockchain.

To reproduce the live blockchain portion:

```text
npm --prefix blockchain run node -- --hostname 127.0.0.1
npm --prefix blockchain run deploy
```

Then start the backend from `backend` so its relative SQLite path resolves to
`backend/psde.db`, start the frontend, authenticate, and repeat the API
workflow described above. The final report is this file:

`research/testing/final_test_report.md`

## Native Windows startup validation

Added `scripts/start.ps1` and `scripts/stop.ps1`. The startup script was
executed with `PSDE_BACKEND_PORT=8003` and `PSDE_FRONTEND_PORT=5174` because
the default ports were not guaranteed to be free. It successfully:

- detected the configured SQLite database and correctly skipped the
  PostgreSQL requirement;
- reused the local Hardhat node and deployed a fresh commitment contract;
- applied Alembic migrations and ran the existing admin bootstrap;
- started Uvicorn and Vite and passed their internal readiness checks;
- recorded only the backend and frontend PIDs in `.psde-runtime/processes.json`;
- wrote service output to `.psde-runtime/logs`;
- stopped the tracked processes with `scripts/stop.ps1` without changing the
  database or research artifacts.

The sandbox terminated isolated service networking before an independent
follow-up HTTP request could reach those processes. The launcher's own
readiness checks passed, and the logs show Uvicorn listening on port 8003.
Run the commands in a normal Windows PowerShell session to keep the services
available after the launcher returns.
