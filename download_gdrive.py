#!/usr/bin/env python3
"""Download all files from a Google Drive folder with progress, retry, and resume."""

import hashlib
import json
import os
import time

import gdown
from tqdm import tqdm

FOLDER_URL = "https://drive.google.com/drive/folders/1jh8XRVZzAH60UjwqKUl5hvg3fBroVgzM"
OUTPUT_DIR = "./gdrive_downloads"
MANIFEST_PATH = os.path.join(OUTPUT_DIR, ".download_manifest.json")
MAX_RETRIES = 5
RETRY_DELAY = 3  # seconds, doubles each retry


def load_manifest():
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, "r") as f:
            return json.load(f)
    return {}


def save_manifest(manifest):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)


def file_md5(filepath):
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def scan_and_track(manifest):
    """Scan output dir and add any new files to the manifest."""
    new_files = 0
    for root, _, filenames in os.walk(OUTPUT_DIR):
        for filename in filenames:
            if filename == ".download_manifest.json":
                continue
            filepath = os.path.join(root, filename)
            rel_path = os.path.relpath(filepath, OUTPUT_DIR)
            md5 = file_md5(filepath)
            key = rel_path

            if key not in manifest:
                manifest[key] = {
                    "filename": rel_path,
                    "md5": md5,
                    "size": os.path.getsize(filepath),
                    "downloaded_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                new_files += 1
    return new_files


def get_existing_files():
    """Get set of relative paths already in output dir."""
    existing = set()
    if os.path.isdir(OUTPUT_DIR):
        for root, _, filenames in os.walk(OUTPUT_DIR):
            for filename in filenames:
                if filename == ".download_manifest.json":
                    continue
                filepath = os.path.join(root, filename)
                rel_path = os.path.relpath(filepath, OUTPUT_DIR)
                existing.add(rel_path)
    return existing


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    manifest = load_manifest()

    before_files = get_existing_files()
    already_count = len(before_files)
    if already_count:
        print(f"Found {already_count} files already downloaded — they will be skipped.")

    delay = RETRY_DELAY
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"\nDownloading files (attempt {attempt}/{MAX_RETRIES})...")
            gdown.download_folder(
                url=FOLDER_URL,
                output=OUTPUT_DIR,
                quiet=False,
                remaining_ok=True,
            )
            break
        except Exception as e:
            if attempt == MAX_RETRIES:
                print(f"\nFailed after {MAX_RETRIES} attempts: {e}")
                print("Saving progress so far...")
            else:
                print(f"\nError: {e}")
                print(f"Retrying in {delay}s...")
                time.sleep(delay)
                delay *= 2

    # Track all files in manifest
    after_files = get_existing_files()
    new_files = after_files - before_files
    new_tracked = scan_and_track(manifest)
    save_manifest(manifest)

    print(f"\nDone! {len(new_files)} new files downloaded, "
          f"{already_count} previously downloaded.")
    print(f"Total files: {len(after_files)}")
    print(f"Files saved to: {os.path.abspath(OUTPUT_DIR)}")
    if len(after_files) > 0:
        print("\nRe-run the script anytime to resume/retry missed files.")


if __name__ == "__main__":
    main()
