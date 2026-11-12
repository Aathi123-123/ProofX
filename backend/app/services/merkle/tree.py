"""
PSDE – Merkle Tree Implementation

A deterministic, binary Merkle tree using SHA-256.

Specification:
- Leaves are ordered lexicographically by artifact_id (documented and enforced)
- Odd-node handling: duplicate the last node (standard Bitcoin-style)
- Proof format: list of {hash, direction} dicts
- All hashes are lowercase hex SHA-256 strings

References:
- Bitcoin Merkle tree: https://en.bitcoin.it/wiki/Protocol_documentation#Merkle_Trees
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal

from app.services.crypto.hashing import combine_hashes, sha256_bytes


@dataclass
class MerkleProofStep:
    """One step in a Merkle inclusion proof."""
    hash: str            # Sibling hash at this level
    direction: Literal["left", "right"]  # Position of the sibling


@dataclass
class MerkleTree:
    """
    Immutable Merkle tree built from a list of leaf hashes.

    Attributes:
        leaves:     Ordered list of leaf SHA-256 hashes (input).
        levels:     Full tree as list of levels (bottom = leaves, top = root).
        root:       The Merkle root hash.
        leaf_count: Number of leaves.
    """
    leaves: list[str]
    levels: list[list[str]] = field(default_factory=list, init=False)
    root: str = field(default="", init=False)
    leaf_count: int = field(default=0, init=False)

    def __post_init__(self):
        if not self.leaves:
            raise ValueError("Cannot build Merkle tree from empty leaf list.")
        # Validate all leaves are 64-char hex strings
        for i, leaf in enumerate(self.leaves):
            if len(leaf) != 64 or not all(c in "0123456789abcdef" for c in leaf.lower()):
                raise ValueError(f"Leaf {i} is not a valid SHA-256 hex hash: {leaf!r}")
        self.leaf_count = len(self.leaves)
        self.levels = self._build_levels(list(self.leaves))
        self.root = self.levels[-1][0]

    @staticmethod
    def _build_levels(leaves: list[str]) -> list[list[str]]:
        """Build all levels of the Merkle tree."""
        levels: list[list[str]] = [leaves]
        current = leaves
        while len(current) > 1:
            next_level: list[str] = []
            # Pad to even length by duplicating last node
            if len(current) % 2 == 1:
                current = current + [current[-1]]
            for i in range(0, len(current), 2):
                next_level.append(combine_hashes(current[i], current[i + 1]))
            levels.append(next_level)
            current = next_level
        return levels


def build_merkle_tree(leaf_hashes: list[str]) -> MerkleTree:
    """
    Build a Merkle tree from a list of SHA-256 leaf hashes.
    Leaf order MUST be deterministic (caller is responsible).
    Raises ValueError if the list is empty or contains invalid hashes.
    """
    return MerkleTree(leaves=leaf_hashes)


def get_merkle_root(leaf_hashes: list[str]) -> str:
    """Return just the Merkle root for a list of leaf hashes."""
    tree = build_merkle_tree(leaf_hashes)
    return tree.root


def generate_merkle_proof(tree: MerkleTree, leaf_index: int) -> list[MerkleProofStep]:
    """
    Generate a Merkle inclusion proof for the leaf at leaf_index.

    The proof is a list of sibling hashes from leaf to root.
    Each step contains the sibling's hash and its direction relative to
    the current node (i.e., left/right of the current node's sibling).

    Args:
        tree: The MerkleTree instance.
        leaf_index: Zero-based index of the target leaf.

    Returns:
        List of MerkleProofStep objects.

    Raises:
        IndexError: If leaf_index is out of range.
    """
    if leaf_index < 0 or leaf_index >= tree.leaf_count:
        raise IndexError(
            f"leaf_index {leaf_index} out of range [0, {tree.leaf_count - 1}]"
        )

    proof: list[MerkleProofStep] = []
    index = leaf_index

    for level_idx, level in enumerate(tree.levels[:-1]):  # exclude root level
        # Pad level to even length (mirror tree construction)
        padded = level if len(level) % 2 == 0 else level + [level[-1]]

        if index % 2 == 0:
            # Current node is left child → sibling is right
            sibling_index = index + 1
            proof.append(MerkleProofStep(
                hash=padded[sibling_index],
                direction="right",
            ))
        else:
            # Current node is right child → sibling is left
            sibling_index = index - 1
            proof.append(MerkleProofStep(
                hash=padded[sibling_index],
                direction="left",
            ))

        # Move up to the parent level
        index = index // 2

    return proof


def verify_merkle_proof(
    leaf_hash: str,
    proof: list[MerkleProofStep],
    expected_root: str,
) -> bool:
    """
    Verify a Merkle inclusion proof.

    Reconstructs the Merkle root from the leaf hash and proof steps,
    then compares with the expected root.

    Args:
        leaf_hash:     SHA-256 hash of the leaf to verify.
        proof:         Proof steps from generate_merkle_proof().
        expected_root: The committed Merkle root to verify against.

    Returns:
        True if the proof is valid and the leaf is included in the tree
        with the given root, False otherwise.
    """
    import hmac as _hmac
    current = leaf_hash.lower()
    expected_root = expected_root.lower()

    for step in proof:
        sibling = step.hash.lower()
        if step.direction == "right":
            # Current is left, sibling is right
            current = combine_hashes(current, sibling)
        else:
            # Current is right, sibling is left
            current = combine_hashes(sibling, current)

    # Constant-time comparison
    return _hmac.compare_digest(current, expected_root)


def proof_to_dict(proof: list[MerkleProofStep]) -> list[dict]:
    """Serialise proof steps to a list of dicts (JSON-safe)."""
    return [{"hash": step.hash, "direction": step.direction} for step in proof]


def dict_to_proof(data: list[dict]) -> list[MerkleProofStep]:
    """Deserialise proof steps from a list of dicts."""
    return [MerkleProofStep(hash=s["hash"], direction=s["direction"]) for s in data]
