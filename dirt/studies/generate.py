#!/usr/bin/env python3
"""Generate reference studies for DIRT with OpenAI's image API.

DIRT itself stays procedural, made from the saved paintings. These studies are references to tune it against, as
the saved Twombly works are: pictures of what a passage, a transition or a creature could look like at its best,
which DIRT's procedures are then compared with and pushed toward. Nothing generated is pasted into DIRT.

Prompts live in prompts.json beside this file, in order of what DIRT needs most. Each run takes the next ones not yet
made, up to --max, and writes each image and a line in log.jsonl (its prompt, model, size, date) to the study folder,
which is private (dirt/private/studies/) and never committed.

    OPENAI_API_KEY=... python3 dirt/studies/generate.py [--max 5] [--model gpt-image-1] [--quality medium]

The key is read from the environment only. The API bills per image.
"""

import argparse
import base64
import datetime
import json
import os
import sys
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "private" / "studies"
API = "https://api.openai.com/v1/images/generations"


def made():
    log = OUT / "log.jsonl"
    return {json.loads(l)["id"] for l in log.read_text().splitlines() if l.strip()} if log.exists() else set()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=5, help="images this run")
    ap.add_argument("--model", default=os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1"))
    ap.add_argument("--quality", default="medium", help="low, medium or high (high costs most)")
    ap.add_argument("--size", default="1536x1024")
    ap.add_argument("--only", help="make this prompt id, even if made before")
    args = ap.parse_args()
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY is not set in this environment")
    prompts = json.loads((HERE / "prompts.json").read_text())
    done = made()
    todo = [p for p in prompts if p["id"] == args.only] if args.only else [p for p in prompts if p["id"] not in done]
    OUT.mkdir(parents=True, exist_ok=True)
    for p in todo[: args.max]:
        r = requests.post(API, headers={"Authorization": f"Bearer {key}"}, timeout=300,
                          json={"model": args.model, "prompt": p["prompt"], "size": args.size, "quality": args.quality, "n": 1})
        if r.status_code != 200:
            print(p["id"], "failed:", r.status_code, r.text[:500])
            if r.status_code in (401, 403, 429):
                break                                                   # no key, no access, or out of allowance: stop for today
            continue
        img = OUT / f"{datetime.date.today()}-{p['id']}.png"
        img.write_bytes(base64.b64decode(r.json()["data"][0]["b64_json"]))
        with open(OUT / "log.jsonl", "a") as f:
            f.write(json.dumps({"id": p["id"], "file": img.name, "model": args.model, "size": args.size, "quality": args.quality,
                                "date": str(datetime.date.today()), "prompt": p["prompt"]}) + "\n")
        print("made", img)


if __name__ == "__main__":
    main()
