#!/usr/bin/env python3
"""Download all files from a Google Drive folder with progress, retry, and resume.

Usage:
    python download_gdrive.py <google_drive_url> <folder_name>

Example:
    python download_gdrive.py "https://drive.google.com/drive/folders/abc123" "Dragon Ball"

Files are downloaded into MANGA_DIR/<folder_name>/ (default MANGA_DIR: ~/manga).
"""

import argparse
import hashlib
import json
import os
import sys
import time

import gdown

MANGA_DIR = os.environ.get("MANGA_DIR", os.path.expanduser("~/manga"))
MAX_RETRIES = 5
RETRY_DELAY = 3  # seconds, doubles each retry


def load_manifest(manifest_path):
    if os.path.exists(manifest_path):
        with open(manifest_path, "r") as f:
            return json.load(f)
    return {}


def save_manifest(manifest, manifest_path):
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)


def file_md5(filepath):
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def scan_and_track(manifest, output_dir):
    """Scan output dir and add any new files to the manifest."""
    new_files = 0
    for root, _, filenames in os.walk(output_dir):
        for filename in filenames:
            if filename == ".download_manifest.json":
                continue
            filepath = os.path.join(root, filename)
            rel_path = os.path.relpath(filepath, output_dir)
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


def get_existing_files(output_dir):
    """Get set of relative paths already in output dir."""
    existing = set()
    if os.path.isdir(output_dir):
        for root, _, filenames in os.walk(output_dir):
            for filename in filenames:
                if filename == ".download_manifest.json":
                    continue
                filepath = os.path.join(root, filename)
                rel_path = os.path.relpath(filepath, output_dir)
                existing.add(rel_path)
    return existing


def main():
    parser = argparse.ArgumentParser(
        description="Download files from a Google Drive folder into your manga directory."
    )
    parser.add_argument("url", help="Google Drive folder URL")
    parser.add_argument("folder", help="Folder name inside the manga directory (e.g. 'Dragon Ball')")
    args = parser.parse_args()

    output_dir = os.path.join(MANGA_DIR, args.folder)
    manifest_path = os.path.join(output_dir, ".download_manifest.json")

    os.makedirs(output_dir, exist_ok=True)
    manifest = load_manifest(manifest_path)

    print(f"Manga directory: {MANGA_DIR}")
    print(f"Downloading to:  {output_dir}")

    before_files = get_existing_files(output_dir)
    already_count = len(before_files)
    if already_count:
        print(f"Found {already_count} files already downloaded — they will be skipped.")

    delay = RETRY_DELAY
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"\nDownloading files (attempt {attempt}/{MAX_RETRIES})...")
            gdown.download_folder(
                url=args.url,
                output=output_dir,
                quiet=False,
                remaining_ok=True,
                resume=True,
            )
            break
        except Exception as e:
            current_files = get_existing_files(output_dir)
            new_this_attempt = current_files - before_files
            if attempt == MAX_RETRIES:
                print(f"\nFailed after {MAX_RETRIES} attempts: {e}")
                print("Saving progress so far...")
            elif len(new_this_attempt) == 0 and attempt > 1:
                print(f"\nNo new files downloaded on attempt {attempt}, giving up.")
                print(f"Error was: {e}")
                break
            else:
                print(f"\nError: {e}")
                print(f"Retrying in {delay}s...")
                time.sleep(delay)
                delay *= 2

    # Clean up partial/incomplete downloads (.part files)
    part_files = []
    for root, _, filenames in os.walk(output_dir):
        for filename in filenames:
            if filename.endswith(".part"):
                part_path = os.path.join(root, filename)
                part_files.append(os.path.relpath(part_path, output_dir))
                os.remove(part_path)
    if part_files:
        print(f"\nCleaned up {len(part_files)} incomplete partial downloads:")
        for pf in part_files:
            print(f"  - {pf}")

    # Track all files in manifest
    after_files = get_existing_files(output_dir)
    new_files = after_files - before_files
    scan_and_track(manifest, output_dir)
    save_manifest(manifest, manifest_path)

    # Report skipped files from manifest (previously seen but not present now)
    missing = [f for f in manifest if f not in after_files and not f.endswith(".part")]

    print(f"\nDone! {len(new_files)} new files downloaded, "
          f"{already_count} previously downloaded.")
    print(f"Total files: {len(after_files)}")
    print(f"Files saved to: {os.path.abspath(output_dir)}")
    if missing:
        print(f"\n{len(missing)} files from previous runs are missing (may have been moved):")
        for f in missing:
            print(f"  - {f}")
    if len(after_files) > 0:
        print("\nRe-run the script anytime to resume/retry missed files.")


if __name__ == "__main__":
    main()
