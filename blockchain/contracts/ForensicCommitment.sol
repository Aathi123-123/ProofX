// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ForensicCommitment
 * @dev Smart contract for anchoring digital forensic evidence commitments.
 *
 * IMPORTANT SECURITY NOTE:
 * This contract DOES NOT store raw evidence, personally identifiable information (PII),
 * or any sensitive data. It strictly acts as a cryptographic commitment layer
 * (anchoring Merkle roots) to prove dataset integrity and chain of custody.
 */
contract ForensicCommitment {
    struct Commitment {
        bytes32 merkleRoot;
        uint256 timestamp;
        string algorithm; // e.g. "SHA-256"
        uint256 evidenceCount;
        address commitmentCreator;
        bool exists;
    }

    // Mapping: caseId => (datasetVersion => Commitment)
    mapping(string => mapping(uint256 => Commitment)) private commitments;

    event CommitmentRegistered(
        string indexed caseId,
        bytes32 merkleRoot,
        uint256 datasetVersion,
        uint256 timestamp
    );

    /**
     * @dev Registers a new Merkle commitment for a specific case dataset version.
     * @param caseId The unique identifier of the investigation case.
     * @param merkleRoot The root hash of the Merkle tree containing the evidence hashes.
     * @param datasetVersion The version number of the evidence dataset.
     * @param algorithm The hashing algorithm used (e.g. "SHA-256").
     * @param evidenceCount The number of evidence artifacts in this version.
     */
    function registerCommitment(
        string memory caseId,
        bytes32 merkleRoot,
        uint256 datasetVersion,
        string memory algorithm,
        uint256 evidenceCount
    ) external {
        require(bytes(caseId).length > 0, "Case ID cannot be empty");
        require(merkleRoot != bytes32(0), "Merkle root cannot be empty");
        require(datasetVersion > 0, "Dataset version must be > 0");
        require(!commitments[caseId][datasetVersion].exists, "Commitment for this version already exists");

        uint256 currentTimestamp = block.timestamp;

        commitments[caseId][datasetVersion] = Commitment({
            merkleRoot: merkleRoot,
            timestamp: currentTimestamp,
            algorithm: algorithm,
            evidenceCount: evidenceCount,
            commitmentCreator: msg.sender,
            exists: true
        });

        emit CommitmentRegistered(caseId, merkleRoot, datasetVersion, currentTimestamp);
    }

    /**
     * @dev Retrieves a previously registered commitment.
     * @param caseId The unique identifier of the investigation case.
     * @param datasetVersion The version number of the evidence dataset.
     * @return merkleRoot The root hash of the Merkle tree.
     * @return timestamp The block timestamp when the commitment was registered.
     * @return algorithm The hashing algorithm used.
     * @return evidenceCount The number of evidence artifacts.
     * @return commitmentCreator The address that registered the commitment.
     * @return exists Boolean flag indicating if the commitment exists.
     */
    function getCommitment(string memory caseId, uint256 datasetVersion)
        external
        view
        returns (
            bytes32 merkleRoot,
            uint256 timestamp,
            string memory algorithm,
            uint256 evidenceCount,
            address commitmentCreator,
            bool exists
        )
    {
        Commitment memory c = commitments[caseId][datasetVersion];
        return (
            c.merkleRoot,
            c.timestamp,
            c.algorithm,
            c.evidenceCount,
            c.commitmentCreator,
            c.exists
        );
    }
}
