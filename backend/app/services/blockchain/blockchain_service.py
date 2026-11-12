"""
PSDE – Blockchain Integration Service (web3.py)

Interacts with the deployed ForensicCommitment.sol smart contract
on a local Hardhat development network.

IMPORTANT DESIGN NOTES:
- Blockchain is used ONLY as a cryptographic commitment layer.
- No raw evidence, PII, or private keys are stored on-chain.
- The contract stores: case_id, merkle_root, dataset_version, timestamp.
- This is a LOCAL DEVELOPMENT NETWORK (Hardhat). It is not a public blockchain.
- All blockchain calls may fail gracefully; the system continues to function.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

# ABI for ForensicCommitment contract (minimal interface)
COMMITMENT_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "caseId", "type": "string"},
            {"internalType": "bytes32", "name": "merkleRoot", "type": "bytes32"},
            {"internalType": "uint256", "name": "datasetVersion", "type": "uint256"},
            {"internalType": "string", "name": "algorithm", "type": "string"},
            {"internalType": "uint256", "name": "evidenceCount", "type": "uint256"},
        ],
        "name": "registerCommitment",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "string", "name": "caseId", "type": "string"},
            {"internalType": "uint256", "name": "datasetVersion", "type": "uint256"},
        ],
        "name": "getCommitment",
        "outputs": [
            {"internalType": "bytes32", "name": "merkleRoot", "type": "bytes32"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"internalType": "string", "name": "algorithm", "type": "string"},
            {"internalType": "uint256", "name": "evidenceCount", "type": "uint256"},
            {"internalType": "address", "name": "commitmentCreator", "type": "address"},
            {"internalType": "bool", "name": "exists", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "string", "name": "caseId", "type": "string"},
            {"indexed": False, "internalType": "bytes32", "name": "merkleRoot", "type": "bytes32"},
            {"indexed": False, "internalType": "uint256", "name": "datasetVersion", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"},
        ],
        "name": "CommitmentRegistered",
        "type": "event",
    },
]


def _get_web3():
    """Get a Web3 connection to the configured blockchain network."""
    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider(settings.blockchain_rpc_url))
        return w3
    except ImportError:
        raise RuntimeError("web3 package is not installed")


def _merkle_root_to_bytes32(hex_str: str) -> bytes:
    """Convert a 64-char hex SHA-256 string to bytes32."""
    clean = hex_str.lower().replace("0x", "")
    if len(clean) != 64:
        raise ValueError(f"Expected 64-char hex string, got {len(clean)} chars")
    return bytes.fromhex(clean)


class BlockchainService:
    """
    Manages interactions with the ForensicCommitment smart contract.
    Fails gracefully if the blockchain is unavailable.
    """

    def __init__(self):
        self._w3 = None
        self._contract = None

    def _ensure_connected(self):
        """Lazily connect to blockchain."""
        if self._w3 is None:
            self._w3 = _get_web3()

        if not settings.commitment_contract_address:
            raise RuntimeError(
                "COMMITMENT_CONTRACT_ADDRESS is not configured. "
                "Deploy the contract first: cd blockchain && npx hardhat run scripts/deploy.js"
            )

        if self._contract is None:
            from web3 import Web3
            self._contract = self._w3.eth.contract(
                address=Web3.to_checksum_address(settings.commitment_contract_address),
                abi=COMMITMENT_ABI,
            )

    def is_available(self) -> bool:
        """Check if the blockchain node is reachable and contract is deployed."""
        try:
            w3 = _get_web3()
            connected = w3.is_connected()
            has_address = bool(settings.commitment_contract_address)
            return connected and has_address
        except Exception:
            return False

    def register_commitment(
        self,
        case_id: str,
        merkle_root_hex: str,
        dataset_version: int,
        algorithm: str = "SHA-256",
        evidence_count: int = 0,
    ) -> dict[str, Any]:
        """
        Register a Merkle commitment on-chain.

        Args:
            case_id: The case identifier (stored as string on-chain).
            merkle_root_hex: 64-char SHA-256 hex string.
            dataset_version: Integer version number.
            algorithm: Hash algorithm label (informational).
            evidence_count: Number of evidence artifacts.

        Returns:
            Dict with tx_hash, block_number, contract_address, timestamp.

        Raises:
            RuntimeError: If blockchain is unavailable or contract not deployed.
        """
        self._ensure_connected()

        root_bytes32 = _merkle_root_to_bytes32(merkle_root_hex)

        # Use deployer account
        from web3 import Web3
        if settings.blockchain_deployer_private_key:
            account = self._w3.eth.account.from_key(settings.blockchain_deployer_private_key)
            sender = account.address
        else:
            sender = self._w3.eth.accounts[0]

        # Build transaction
        nonce = self._w3.eth.get_transaction_count(sender)
        tx = self._contract.functions.registerCommitment(
            case_id,
            root_bytes32,
            dataset_version,
            algorithm,
            evidence_count,
        ).build_transaction({
            "from": sender,
            "nonce": nonce,
            "gas": 200000,
            "gasPrice": self._w3.eth.gas_price,
        })

        # Sign and send
        if settings.blockchain_deployer_private_key:
            signed = self._w3.eth.account.sign_transaction(tx, settings.blockchain_deployer_private_key)
            tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        else:
            tx_hash = self._w3.eth.send_transaction(tx)

        # Wait for receipt
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

        block_num = receipt.get("blockNumber") if hasattr(receipt, "get") else getattr(receipt, "blockNumber", getattr(receipt, "block_number", None))
        block = self._w3.eth.get_block(block_num)
        block_timestamp = datetime.fromtimestamp(block.timestamp, tz=timezone.utc)

        raw_tx_hash = receipt.get("transactionHash") if hasattr(receipt, "get") else getattr(receipt, "transactionHash", getattr(receipt, "transaction_hash", tx_hash))
        tx_hash_hex = raw_tx_hash.hex() if hasattr(raw_tx_hash, "hex") else str(raw_tx_hash)
        gas_used = receipt.get("gasUsed") if hasattr(receipt, "get") else getattr(receipt, "gasUsed", getattr(receipt, "gas_used", 0))
        status_val = receipt.get("status") if hasattr(receipt, "get") else getattr(receipt, "status", 1)

        result = {
            "tx_hash": tx_hash_hex,
            "block_number": block_num,
            "contract_address": settings.commitment_contract_address,
            "blockchain_network": settings.blockchain_network,
            "blockchain_timestamp": block_timestamp.isoformat(),
            "gas_used": gas_used,
            "status": "success" if status_val == 1 else "failed",
        }
        logger.info("blockchain_commitment_registered", **{k: v for k, v in result.items() if k != "tx_hash"})
        return result

    def get_commitment(
        self,
        case_id: str,
        dataset_version: int,
    ) -> dict[str, Any] | None:
        """
        Retrieve a commitment from the blockchain.

        Returns None if the commitment does not exist.
        """
        try:
            self._ensure_connected()
            result = self._contract.functions.getCommitment(case_id, dataset_version).call()
            merkle_root_bytes, timestamp, algorithm, evidence_count, creator, exists = result

            if not exists:
                return None

            return {
                "merkle_root": merkle_root_bytes.hex(),
                "timestamp": datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat(),
                "algorithm": algorithm,
                "evidence_count": evidence_count,
                "commitment_creator": creator,
                "exists": True,
                "contract_address": settings.commitment_contract_address,
                "blockchain_network": settings.blockchain_network,
            }
        except Exception as e:
            logger.warning("blockchain_get_commitment_failed", error=str(e))
            return None

    def verify_on_chain(
        self,
        case_id: str,
        dataset_version: int,
        expected_merkle_root: str,
    ) -> dict[str, Any]:
        """
        Verify that the on-chain commitment matches a given Merkle root.

        Returns a verification result dict.
        """
        commitment = self.get_commitment(case_id, dataset_version)

        if commitment is None:
            return {
                "verified": False,
                "status": "COMMITMENT_NOT_FOUND",
                "message": f"No on-chain commitment found for case {case_id} version {dataset_version}",
            }

        import hmac
        on_chain_root = commitment["merkle_root"].lower().lstrip("0x")
        expected_root = expected_merkle_root.lower().lstrip("0x")

        # Pad on-chain root (bytes32 may have leading zeros)
        if len(on_chain_root) < 64:
            on_chain_root = on_chain_root.zfill(64)

        match = hmac.compare_digest(on_chain_root, expected_root)

        return {
            "verified": match,
            "status": "BLOCKCHAIN_VERIFIED" if match else "BLOCKCHAIN_MISMATCH",
            "on_chain_root": on_chain_root,
            "expected_root": expected_root,
            "commitment_timestamp": commitment.get("timestamp"),
            "commitment_creator": commitment.get("commitment_creator"),
            "message": (
                "On-chain Merkle root matches expected root."
                if match else
                "MISMATCH: On-chain Merkle root does not match expected root."
            ),
        }


# Module-level singleton
_blockchain_service: BlockchainService | None = None


def get_blockchain_service() -> BlockchainService:
    global _blockchain_service
    if _blockchain_service is None:
        _blockchain_service = BlockchainService()
    return _blockchain_service
