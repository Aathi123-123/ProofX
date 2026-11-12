"""
PSDE – Synthetic Dataset Generator
Generates deterministic synthetic forensic evidence datasets.
"""
import argparse
import hashlib
import json
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Deterministic PII generation for benchmarks
MOCK_NAMES = ["Alice Smith", "Bob Jones", "Charlie Brown", "Diana Prince", "Eve Hacker"]
MOCK_EMAILS = [
    "alice.smith@example.com", "bob.jones@corporate.org", 
    "charlie.brown@school.edu", "diana.prince@gov.org", 
    "eve.hacker@evil.net"
]
MOCK_PHONES = ["555-0100", "555-0101", "555-0102", "555-0103", "555-0104"]
MOCK_CREDIT_CARDS = ["4532019283746571", "5412758493021928"]

def get_random(seed: int):
    return random.Random(seed)

def generate_artifact(index: int, seed: int, out_dir: Path, target_keywords: list[str]):
    rng = get_random(seed + index)
    
    artifact_id = f"EV-{index:06d}"
    mime_type = rng.choice(["text/plain", "application/json", "text/csv"])
    
    content = ""
    is_sensitive = rng.random() < 0.3
    is_relevant = rng.random() < 0.2
    
    if mime_type == "text/plain":
        content = f"Log entry {artifact_id}\nTimestamp: {datetime.now(timezone.utc).isoformat()}\n"
        content += "Status: OK\n"
        if is_sensitive:
            content += f"User: {rng.choice(MOCK_NAMES)} Email: {rng.choice(MOCK_EMAILS)}\n"
            if rng.random() < 0.5:
                content += f"Phone: {rng.choice(MOCK_PHONES)}\n"
        if is_relevant:
            content += f"Keyword match: {rng.choice(target_keywords)}\n"
            
        filename = f"{artifact_id}_syslog.txt"
        
    elif mime_type == "application/json":
        data = {
            "id": artifact_id,
            "type": "event",
            "metadata": {"source": "app_server", "version": "1.0"}
        }
        if is_sensitive:
            data["user"] = {
                "name": rng.choice(MOCK_NAMES),
                "email": rng.choice(MOCK_EMAILS),
                "cc": rng.choice(MOCK_CREDIT_CARDS) if rng.random() < 0.2 else None
            }
        if is_relevant:
            data["notes"] = f"Investigation relates to {rng.choice(target_keywords)}"
            
        content = json.dumps(data, indent=2)
        filename = f"{artifact_id}_event.json"
        
    else: # csv
        content = "id,timestamp,value,note\n"
        for i in range(5):
            note = rng.choice(target_keywords) if is_relevant and i==0 else "routine"
            val = rng.choice(MOCK_EMAILS) if is_sensitive and i==0 else f"val_{i}"
            content += f"{i},{datetime.now().isoformat()},{val},{note}\n"
        filename = f"{artifact_id}_data.csv"
        
    file_path = out_dir / filename
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    return {
        "artifact_id": artifact_id,
        "filename": filename,
        "mime_type": mime_type,
        "ground_truth_sensitive": is_sensitive,
        "ground_truth_relevant": is_relevant
    }

def generate_dataset(size: int, seed: int, output_dir: str):
    out_path = Path(output_dir) / f"D{size}_seed{seed}"
    out_path.mkdir(parents=True, exist_ok=True)
    
    target_keywords = ["fraud", "embezzlement", "insider", "unauthorized"]
    
    manifest = []
    for i in range(1, size + 1):
        info = generate_artifact(i, seed, out_path, target_keywords)
        manifest.append(info)
        
    manifest_path = out_path / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({
            "dataset_size": size,
            "seed": seed,
            "investigation_purpose": "Identify instances of fraud and unauthorized access.",
            "target_keywords": target_keywords,
            "artifacts": manifest
        }, f, indent=2)
        
    print(f"Generated dataset of {size} artifacts at {out_path}")
    return out_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=str, default="./datasets")
    args = parser.parse_args()
    generate_dataset(args.size, args.seed, args.output)
