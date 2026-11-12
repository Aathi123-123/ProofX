# PSDE Execution Plan

## 1. Current Architecture
The current project (PSDE) consists of:
- **Backend**: FastAPI + PostgreSQL (using SQLAlchemy and asyncpg).
- **Frontend**: React + TypeScript + Vite.
- **Blockchain**: Local Hardhat network + Solidity smart contracts.
- **Privacy Engine**: Deterministic privacy rule-based engine (Regex/Metadata).
- **Core Workflow**: Offline-first, evidence hashing (SHA-256), Merkle tree anchoring to blockchain, selective disclosure and verification.

## 2. Available Commands
- **Backend**:
  - `python -m venv .venv` and `pip install -r requirements.txt`
  - `alembic upgrade head`
  - `python -m app.core.bootstrap`
  - `uvicorn app.main:app --reload`
- **Blockchain**:
  - `npx hardhat node`
  - `npx hardhat run scripts/deploy.js --network localhost`
- **Frontend**:
  - `npm install` and `npm run dev`
- **Benchmarking & Datasets**:
  - `python scripts/generate_dataset.py --size 100`
  - `python benchmarks/run.py --dataset D100`
  - `python research/generate_report.py`
- **Tests**:
  - `pytest` (to be executed after virtualenv setup)

## 3. Existing Test Coverage
- From initial inspection, the `backend/tests` directory exists but appears empty. The project may be lacking comprehensive test suites, or tests are yet to be fully populated/discovered.

## 4. Existing Benchmark Functionality
- `benchmarks/run.py` is present and set up to run against generated datasets.
- `scripts/generate_dataset.py` exists to create synthetic test data deterministically.
- `research/generate_report.py` is mentioned but needs verification of its exact implementation and output format.

## 5. Missing Validation Components
- Ground truth verification scripts (dataset_validation.json generation).
- End-to-End full functional validation script (`e2e_results.json`).
- Security/Tampering attack simulations (`security_attack_results.json`).
- Isolated ablation and scalability study runners.
- Comprehensive logging and graph generation for the final research report.
- Unit and integration tests (tests appear missing or incomplete).

## 6. Planned Execution Sequence
1. **Environment Setup**: Setup Python venv, install requirements, ensure Docker/Postgres is running, and initialize Hardhat. Check versions and dump `environment.json`.
2. **Test Execution**: Populate/run missing tests and output to `test_results.txt`.
3. **Dataset Generation**: Use `generate_dataset.py` with seed 42 to build D10, D100, D1000, D10000, and validate ground truth.
4. **End-to-End Functional Validation**: Execute a full pipeline run (CASE-001) manually or via script, including a tamper test, to produce `e2e_results.json`.
5. **Benchmarks**: Update `benchmarks/run.py` to compare PSDE against the three requested baselines and output structured JSON/CSV.
6. **Security & Validation Experiments**: Execute tampering, versioning, Merkle validation, and ablation studies.
7. **Graph/Table Generation**: Parse benchmark outputs to generate figures (PNG/PDF) and Markdown tables.
8. **Final Report Generation**: Run `generate_report.py` to compile the 25-40 page research report.
9. **Clean Up & Reproducibility**: Ensure `scripts/reproduce_research.sh` works seamlessly to reproduce the environment.
