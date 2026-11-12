# PSDE: Privacy-Preserving Selective Disclosure of Digital Forensic Evidence Using Blockchain-Backed Cryptographic Commitments

## Overview
PSDE is an advanced research prototype designed to solve a fundamental conflict in modern digital forensics: the need to comprehensively acquire and verify digital evidence versus the imperative to protect individuals' privacy (such as PII and irrelevant personal data).

It achieves this through a hybrid architecture:
1. **Offline-First Backend**: A FastAPI + PostgreSQL backend securely manages case data, evidence, and privacy policies locally.
2. **Deterministic Privacy Engine**: Evaluates evidence for PII (Regex/Metadata), calculates Sensitivity (9-factor scoring), and assesses Relevance against the investigation purpose.
3. **Cryptographic Anchoring**: Uses SHA-256 for evidence immutability and Merkle Trees to build a verifiable dataset structure. The Merkle root is anchored to a local blockchain (Ethereum/Hardhat) to establish an irrefutable chain of custody.
4. **Selective Disclosure**: Allows investigators to query and receive only the evidence that is both highly relevant and within acceptable sensitivity limits. The system automatically redacts specific PII types from metadata and generates a Merkle inclusion proof for each disclosed item.
5. **Verification Engine**: A standalone module that allows any party (e.g., opposing counsel, auditor) to independently cryptographically verify a disclosed evidence artifact against the immutable blockchain commitment.

## Architecture & Technology Stack
* **Backend**: FastAPI (Python 3.10+), SQLAlchemy (Async), asyncpg, PostgreSQL, Pydantic, structlog, Passlib.
* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, React Router.
* **Blockchain**: Hardhat, Solidity ^0.8.20, ethers.js, web3.py.
* **Benchmarking**: Custom Python CLI for deterministic dataset generation and metric calculation.

## Setup Instructions

### One-command Windows startup without Docker

The project includes a native PowerShell launcher that detects the configured
SQLite/PostgreSQL database, starts Hardhat, deploys the local commitment
contract, runs Alembic migrations and bootstrap, then starts Uvicorn and Vite:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\start.ps1
```

Stop only the processes started by the launcher:

```powershell
.\scripts\stop.ps1
```

The launcher reads `DATABASE_URL`, `COMMITMENT_CONTRACT_ADDRESS`, and other
settings from the process environment and `backend\.env`; it does not create
or print credentials. With the current configuration, SQLite is used and
PostgreSQL is not required. If `DATABASE_URL` points to PostgreSQL, set
`PSDE_POSTGRES_HOST` and `PSDE_POSTGRES_PORT` if needed and start PostgreSQL
before running the script.

Default URLs:

- Frontend: `http://localhost:5173`
- Backend health: `http://127.0.0.1:8000/health`
- Backend API docs: `http://127.0.0.1:8000/docs`
- Hardhat JSON-RPC: `http://127.0.0.1:8545`

Hardhat's port is an API endpoint, not a web page. Opening
`http://127.0.0.1:8545/` directly in a browser sends an empty `GET` request,
so Hardhat correctly responds with `Parse error: Unexpected end of JSON
input`. Verify it with a JSON-RPC `POST` instead:

```powershell
$body = '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
Invoke-RestMethod -Uri http://127.0.0.1:8545 `
  -Method Post -ContentType 'application/json' -Body $body
```

The expected local chain ID is `0x7a69` (decimal `31337`). Use the frontend or
the backend `/docs` page for the application UI; do not use the Hardhat port as
a browser page.

Logs and PID state are stored under `.psde-runtime\logs` and
`.psde-runtime\processes.json`. The launcher never removes databases, evidence
files, volumes, or research results. Use the log files when a readiness check
or migration fails. Run `.\scripts\start.ps1 -CheckOnly` to validate paths and
resolved configuration without starting services.

### 1. Backend
```bash
cd backend
python -m venv .venv
# Activate venv (Windows): .venv\Scripts\activate
# Activate venv (Unix): source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
# Make sure PostgreSQL is running (or use docker-compose)
alembic upgrade head
python -m app.core.bootstrap
uvicorn app.main:app --reload
```

### 2. Blockchain
```bash
cd blockchain
npm install
npx hardhat node
# In a new terminal:
npx hardhat run scripts/deploy.js --network localhost
# Copy the deployed contract address to your .env file
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Benchmarking
```bash
# Generate a dataset of 100 artifacts
python scripts/generate_dataset.py --size 100

# Run a benchmark against it
python benchmarks/run.py --dataset D100

# Generate Research Report
python research/generate_report.py
```

## System Workflow
1. **Case Creation**: Investigator creates a case and defines the exact `investigation_purpose`.
2. **Evidence Ingestion**: Upload evidence. The system calculates SHA-256 on the *unmodified bytes*, detects PII, and scores Sensitivity/Relevance.
3. **Merkle Commitment**: The case's evidence is ordered lexicographically by ID, hashed into a Merkle Tree, and the root is anchored to the smart contract.
4. **Selective Disclosure**: A verifier requests evidence matching certain filters. The system evaluates the Privacy Policy (Sensitivity vs Relevance) and returns a disclosure package (with redactions applied and Merkle proofs attached).
5. **Verification**: A third party uploads the disclosed file + Merkle proof. The system verifies the file hash, validates the proof against the Merkle root, checks the dataset version, and finally verifies the commitment exists on the blockchain.
