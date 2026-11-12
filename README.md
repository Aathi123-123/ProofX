<div align="center">

# 🔐 ProofX

### Privacy-Preserving Selective Disclosure of Digital Forensic Evidence  
### Using Blockchain-Backed Cryptographic Commitments

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

<br/>

**ProofX** solves a fundamental conflict in modern digital forensics:  
*the need to comprehensively verify digital evidence vs. the imperative to protect individual privacy.*

[🚀 Quick Start](#-quick-start-docker) · [📖 Documentation](#-system-workflow) · [🏗️ Architecture](#-architecture) · [🔧 Manual Setup](#-manual-setup-without-docker)

</div>

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🛡️ Privacy-First Design
9-factor sensitivity scoring with automatic PII detection. Evidence is evaluated against regex & metadata patterns, ensuring personal data never leaks.

</td>
<td width="50%">

### ⛓️ Blockchain Anchoring
SHA-256 hashing + Merkle Trees anchored to an Ethereum smart contract. Establishes an **irrefutable chain of custody** that any party can verify.

</td>
</tr>
<tr>
<td width="50%">

### 🔍 Selective Disclosure
Investigators receive only evidence that is **highly relevant** and within acceptable sensitivity limits — with PII automatically redacted and Merkle proofs attached.

</td>
<td width="50%">

### ✅ Independent Verification
Third parties (counsel, auditors) can cryptographically verify any disclosed artifact against the immutable blockchain commitment — no trust required.

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ProofX Platform                             │
│                                                                     │
│   ┌─────────────┐    ┌──────────────┐    ┌───────────────────────┐ │
│   │   Frontend   │    │   Backend    │    │     Blockchain        │ │
│   │              │    │              │    │                       │ │
│   │  React 18    │───▶│  FastAPI     │───▶│  Hardhat (EVM)       │ │
│   │  TypeScript  │    │  SQLAlchemy  │    │  Solidity ^0.8.20    │ │
│   │  Vite        │    │  Pydantic    │    │  ForensicCommitment  │ │
│   │  Tailwind    │    │  asyncpg     │    │  .sol                │ │
│   │              │    │              │    │                       │ │
│   │  Port: 5173  │    │  Port: 8000  │    │  Port: 8545          │ │
│   └─────────────┘    └──────┬───────┘    └───────────────────────┘ │
│                              │                                      │
│                     ┌────────▼────────┐                             │
│                     │   PostgreSQL    │                             │
│                     │   (16-alpine)   │                             │
│                     │   Port: 5432    │                             │
│                     └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons | Interactive forensic dashboard |
| **Backend** | FastAPI, SQLAlchemy (Async), asyncpg, Pydantic, structlog | REST API, privacy engine, verification pipeline |
| **Blockchain** | Hardhat, Solidity ^0.8.20, ethers.js, web3.py | Immutable commitment anchoring |
| **Database** | PostgreSQL 16 (Docker) / SQLite (dev) | Case, evidence & commitment storage |
| **DevOps** | Docker Compose, multi-stage Dockerfiles | One-command deployment |

---

## 🚀 Quick Start (Docker)

> **Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) v24+ with Compose v2

```bash
# Clone the repository
git clone https://github.com/Aathi123-123/ProofX.git
cd ProofX

# Build and start all 5 services
docker compose up -d --build

# Verify everything is healthy
docker compose ps
```

That's it! 🎉 Open **http://localhost:5173** in your browser.

### 📍 Service Endpoints

| Service | URL | Description |
|:--------|:----|:------------|
| 🌐 **Web UI** | [localhost:5173](http://localhost:5173) | Main application dashboard |
| 📡 **API Docs** | [localhost:8000/docs](http://localhost:8000/docs) | Interactive Swagger documentation |
| ❤️ **Health** | [localhost:8000/health](http://localhost:8000/health) | Backend health check |
| ⛓️ **Blockchain** | `localhost:8545` | JSON-RPC endpoint (POST only) |

### 🔑 Default Credentials

| Mode | Username | Password |
|:-----|:---------|:---------|
| **Docker** | `admin@psde.local` | `AdminPass123!` |
| **Native** | `admin` | `CHANGE_ME_STRONG_PASSWORD` |

> [!IMPORTANT]
> Change the default credentials and secret keys before deploying to production.
> Set `APP_SECRET_KEY`, `JWT_SECRET_KEY`, `BOOTSTRAP_ADMIN_EMAIL`, and
> `BOOTSTRAP_ADMIN_PASSWORD` in a `.env` file at the project root.

---

## 🐳 Docker Deep Dive

### Container Architecture

| Container | Image | Port | Health Check | Depends On |
|:----------|:------|:-----|:-------------|:-----------|
| `psde_frontend` | Node 20 Alpine | `5173` | — | backend |
| `psde_backend` | Python 3.12 Slim | `8000` | — | postgres, hardhat, blockchain-deploy |
| `psde_hardhat` | Node 20 Alpine | `8545` | `nc -z 127.0.0.1 8545` | — |
| `blockchain-deploy` | Node 20 Alpine | — | Exits on success | hardhat (healthy) |
| `psde_postgres` | PostgreSQL 16 Alpine | `5432` | `pg_isready` | — |

### Persistent Volumes

| Volume | Purpose |
|:-------|:--------|
| `psde_postgres_data` | PostgreSQL database files |
| `psde_hardhat_artifacts` | Compiled smart contract ABIs |
| `psde_evidence_store` | Uploaded evidence files |
| `psde_benchmark_results` | Benchmark output data |

### Environment Variables

Create a `.env` file in the project root to override defaults:

```env
# Security (CHANGE THESE IN PRODUCTION)
APP_SECRET_KEY=your_strong_app_secret
JWT_SECRET_KEY=your_strong_jwt_secret

# Admin bootstrap
BOOTSTRAP_ADMIN_EMAIL=admin@psde.local
BOOTSTRAP_ADMIN_PASSWORD=YourStrongPassword!

# Smart contract (auto-deployed, usually no change needed)
COMMITMENT_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Useful Commands

```bash
# 📋 View real-time logs
docker compose logs -f

# 📋 Logs for a specific service
docker compose logs -f backend

# 🛑 Stop all services (data preserved)
docker compose down

# 💣 Full reset (removes all data)
docker compose down -v

# 🔄 Rebuild a single service
docker compose up -d --build backend

# 🐚 Shell into a container
docker exec -it psde_backend sh

# 🗃️ Run migrations manually
docker exec -it psde_backend alembic upgrade head
```

### Troubleshooting

<details>
<summary><b>🔴 Port already allocated</b></summary>

Stop conflicting services or change ports in `docker-compose.yml`:
```bash
# Windows: stop native PSDE services
.\scripts\stop.ps1

# Or find what's using the port
netstat -ano | findstr :8000
```
</details>

<details>
<summary><b>🔴 Backend won't start</b></summary>

Check that the smart contract deployed successfully:
```bash
docker compose logs blockchain-deploy
# Should show: "ForensicCommitment deployed to: 0x5FbDB..."
```
</details>

<details>
<summary><b>🔴 Database connection errors</b></summary>

Verify PostgreSQL is healthy:
```bash
docker compose ps postgres
# Status should show "healthy"
```
</details>

<details>
<summary><b>🔴 Need a completely fresh start</b></summary>

```bash
docker compose down -v --rmi local
docker compose up -d --build
```
</details>

---

## 🔧 Manual Setup (Without Docker)

### One-Command Windows Startup

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\start.ps1
```

Stop all services:

```powershell
.\scripts\stop.ps1
```

> The launcher auto-detects SQLite/PostgreSQL, starts Hardhat, deploys the contract,
> runs Alembic migrations, bootstraps the admin user, then starts Uvicorn and Vite.

### Step-by-Step Setup

<details>
<summary><b>1️⃣ Backend (FastAPI)</b></summary>

```bash
cd backend
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Unix/macOS:
source .venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
alembic upgrade head
python -m app.core.bootstrap
uvicorn app.main:app --reload
```
</details>

<details>
<summary><b>2️⃣ Blockchain (Hardhat)</b></summary>

```bash
cd blockchain
npm install
npx hardhat node

# In a new terminal:
npx hardhat run scripts/deploy.js --network localhost
# Copy the deployed contract address to your .env file
```
</details>

<details>
<summary><b>3️⃣ Frontend (React + Vite)</b></summary>

```bash
cd frontend
npm install
npm run dev
```
</details>

<details>
<summary><b>4️⃣ Benchmarking</b></summary>

```bash
# Generate a dataset of 100 artifacts
python scripts/generate_dataset.py --size 100

# Run a benchmark
python benchmarks/run.py --dataset D100

# Generate research report
python research/generate_report.py
```
</details>

### Default URLs (Native)

| Resource | URL |
|:---------|:----|
| Frontend | [localhost:5173](http://localhost:5173) |
| Backend Health | [localhost:8000/health](http://localhost:8000/health) |
| API Docs | [localhost:8000/docs](http://localhost:8000/docs) |
| Hardhat RPC | `localhost:8545` (JSON-RPC POST only) |

> [!NOTE]
> Hardhat's port is a JSON-RPC endpoint, not a web page. Opening
> `http://localhost:8545` in a browser returns a parse error.
> Verify it with: `curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' http://localhost:8545`

---

## 🔄 System Workflow

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
  │  1. Create   │────▶│  2. Ingest   │────▶│  3. Commitment   │
  │     Case     │     │   Evidence   │     │   (Merkle+Chain) │
  └──────────────┘     └──────────────┘     └──────────────────┘
                                                      │
  ┌──────────────┐     ┌──────────────┐               │
  │ 5. Verify    │◀────│ 4. Disclose  │◀──────────────┘
  │  (3rd Party) │     │ (Selective)  │
  └──────────────┘     └──────────────┘
```

| Step | Action | What Happens |
|:-----|:-------|:-------------|
| **1** | 📁 **Case Creation** | Investigator creates a case with a defined `investigation_purpose` |
| **2** | 📥 **Evidence Ingestion** | Upload evidence → SHA-256 hash computed → PII detected → Sensitivity/Relevance scored |
| **3** | 🌳 **Merkle Commitment** | Evidence ordered by ID → Merkle tree built → Root anchored to smart contract |
| **4** | 🔓 **Selective Disclosure** | Privacy policy evaluated → Relevant evidence disclosed with redactions + Merkle proofs |
| **5** | ✅ **Verification** | Third party uploads file + proof → Hash verified → Proof validated → Blockchain confirmed |

---

## 🔬 Verification Pipeline

Each verification runs through a **4-step cryptographic pipeline**:

| Step | Check | What It Proves |
|:-----|:------|:---------------|
| 1️⃣ | **SHA-256 Hash** | File has not been modified since ingestion |
| 2️⃣ | **Merkle Proof** | Artifact belongs to the committed dataset |
| 3️⃣ | **Dataset Version** | Correct version of the dataset is being verified |
| 4️⃣ | **Blockchain Commitment** | Merkle root matches the on-chain immutable record |

> All four steps must **PASS** for evidence to be considered cryptographically verified. ✅

---

## 📁 Project Structure

```
ProofX/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/             # Route handlers
│   │   ├── core/            # Config, security, bootstrap
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   └── services/        # Business logic (merkle, privacy, verification)
│   ├── alembic/             # Database migrations
│   └── requirements.txt
├── frontend/                # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── lib/             # API client, utilities
│   │   └── types/           # TypeScript type definitions
│   └── package.json
├── blockchain/              # Smart contracts
│   ├── contracts/           # Solidity contracts
│   ├── scripts/             # Deployment scripts
│   └── hardhat.config.js
├── docker/                  # Dockerfiles & init scripts
│   ├── backend/Dockerfile
│   ├── frontend/Dockerfile
│   ├── hardhat/Dockerfile
│   └── postgres/init.sql
├── docker-compose.yml       # Full stack orchestration
├── scripts/                 # Windows launcher scripts
│   ├── start.ps1
│   └── stop.ps1
└── research/                # Benchmarks & research tools
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for Digital Forensics**

*Protecting privacy while preserving truth.*

</div>
