#!/usr/bin/env python3
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Submit an activity page scene graph to the local Figma Bridge.")
    parser.add_argument("page_json", help="Path to activity-page.v0.1 page.json")
    parser.add_argument("--bridge-url", default="http://localhost:39217", help="Local Bridge URL")
    parser.add_argument("--assets-root", help="Asset root. Defaults to the page.json parent directory.")
    parser.add_argument("--wait", action="store_true", help="Wait for the Figma plugin to complete the job.")
    parser.add_argument("--timeout", type=int, default=300, help="Wait timeout in seconds.")
    args = parser.parse_args()

    page_path = Path(args.page_json).expanduser().resolve()
    assets_root = Path(args.assets_root).expanduser().resolve() if args.assets_root else page_path.parent

    with page_path.open("r", encoding="utf-8") as f:
        page = json.load(f)

    assert_page_ready_for_submit(page, page_path)

    payload = {
        "type": "figma.activityPage.import",
        "source": "codex-skill",
        "assetsRoot": str(assets_root),
        "payload": {
            "page": page
        }
    }

    created = request_json(
        f"{args.bridge_url.rstrip('/')}/api/figma-bridge/jobs",
        method="POST",
        body=payload,
    )
    job = created["job"]
    print(f"Submitted {job['id']}")
    print(f"Status: {job['status']}")

    if args.wait:
        wait_for_job(args.bridge_url.rstrip("/"), job["id"], args.timeout)


def wait_for_job(bridge_url, job_id, timeout):
    deadline = time.time() + timeout
    last_status = None

    while time.time() < deadline:
        time.sleep(1.2)
        data = request_json(f"{bridge_url}/api/figma-bridge/jobs/{job_id}")
        job = data["job"]
        status = job["status"]
        if status != last_status:
            print(f"Status: {status}")
            last_status = status
        if status in ("completed", "failed"):
            print(json.dumps(job, ensure_ascii=False, indent=2))
            if status == "failed":
                sys.exit(2)
            return

    raise SystemExit(f"Timed out waiting for {job_id}")


def request_json(url, method="GET", body=None):
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Bridge request failed: HTTP {error.code} {detail}")
    except urllib.error.URLError as error:
        raise SystemExit(f"Bridge is not reachable at {url}: {error.reason}")


def assert_page_ready_for_submit(page, page_path):
    metadata = page.get("metadata") or {}
    has_recognition = bool(metadata.get("recognitionApplied"))
    from_baseline_parser = metadata.get("parser") == "parse-image-package.mjs"
    flat_import_mode = metadata.get("importMode") == "flat-source-image"
    quality = analyze_page_quality(page)
    needs_recognition = (
        metadata.get("requiresRecognition") is True
        or metadata.get("recognitionRequired") is True
        or metadata.get("baselineOnly") is True
        or metadata.get("pipelineState") == "requires-codex-recognition"
        or (from_baseline_parser and not has_recognition)
    )

    if needs_recognition and not has_recognition:
        raise SystemExit(
            "Refusing to submit unrecognized baseline package: "
            f"{page_path}. Run recognize:prepare, fill recognition.json with Codex, "
            "create required image2 transparent assets, run apply:recognition, then submit again."
        )

    if has_recognition and metadata.get("recognitionComplete") is False:
        raise SystemExit(
            "Refusing to submit incomplete recognition package: "
            f"{page_path}. Finish pending image2 text-image or foreground cutout assets, "
            "rerun apply:recognition, then submit again."
        )

    if metadata.get("image2ForegroundRequired") is True and quality["foreground_layers"] == 0:
        raise SystemExit(
            "Refusing to submit missing image2 foreground layers: "
            f"{page_path}. Create clean transparent assets with image2 background removal "
            "and rerun apply:recognition."
        )

    if flat_import_mode or quality["full_canvas_images"] > 0:
        raise SystemExit(
            "Refusing to submit flat full-image import: "
            f"{page_path}. A single full-canvas PNG/JPG layer is not an element-layered reconstruction."
        )

    if (from_baseline_parser or has_recognition) and quality["semantic_layers"] == 0:
        raise SystemExit(
            "Refusing to submit non-layered parser package: "
            f"{page_path}. The page still contains only background images. "
            "Run real Codex element recognition and apply the resulting layers before submitting."
        )

    if has_recognition and quality["semantic_layers"] < 8:
        raise SystemExit(
            "Refusing to submit insufficiently layered package: "
            f"{page_path}. Only {quality['semantic_layers']} semantic layer(s) were found."
        )


def analyze_page_quality(page):
    canvas = page.get("canvas") or {}
    result = {"semantic_layers": 0, "full_canvas_images": 0, "foreground_layers": 0}
    for section in page.get("sections") or []:
        section_result = analyze_layer_list(
            section.get("children") or [],
            {"x": number_or(section.get("x"), 0), "y": number_or(section.get("y"), 0)},
            canvas,
        )
        result["semantic_layers"] += section_result["semantic_layers"]
        result["full_canvas_images"] += section_result["full_canvas_images"]
        result["foreground_layers"] += section_result["foreground_layers"]
    loose_result = analyze_layer_list(page.get("nodes") or [], {"x": 0, "y": 0}, canvas)
    result["semantic_layers"] += loose_result["semantic_layers"]
    result["full_canvas_images"] += loose_result["full_canvas_images"]
    result["foreground_layers"] += loose_result["foreground_layers"]
    return result


def analyze_layer_list(nodes, parent_offset, canvas):
    result = {"semantic_layers": 0, "full_canvas_images": 0, "foreground_layers": 0}
    for node in nodes:
        if not isinstance(node, dict):
            continue
        layer = {
            "type": node.get("type"),
            "absolute_x": parent_offset["x"] + number_or(node.get("x"), 0),
            "absolute_y": parent_offset["y"] + number_or(node.get("y"), 0),
            "width": number_or(node.get("width"), 0),
            "height": number_or(node.get("height"), 0),
        }
        if is_semantic_layer_type(layer["type"]):
            result["semantic_layers"] += 1
        if layer["type"] in {"foregroundImage", "decorativeImage"}:
            result["foreground_layers"] += 1
        if is_full_canvas_image(layer, canvas):
            result["full_canvas_images"] += 1
        if isinstance(node.get("children"), list):
            child_result = analyze_layer_list(
                node["children"],
                {"x": layer["absolute_x"], "y": layer["absolute_y"]},
                canvas,
            )
            result["semantic_layers"] += child_result["semantic_layers"]
            result["full_canvas_images"] += child_result["full_canvas_images"]
            result["foreground_layers"] += child_result["foreground_layers"]
    return result


def is_semantic_layer_type(layer_type):
    return layer_type in {
        "editableText",
        "text",
        "textImage",
        "foregroundImage",
        "decorativeImage",
        "shape",
        "hotspot",
    }


def is_full_canvas_image(layer, canvas):
    if layer["type"] != "image":
        return False
    canvas_width = number_or(canvas.get("width"), 0)
    canvas_height = number_or(canvas.get("height"), 0)
    if not canvas_width or not canvas_height:
        return False
    area_ratio = (layer["width"] * layer["height"]) / (canvas_width * canvas_height)
    near_origin = abs(layer["absolute_x"]) <= 2 and abs(layer["absolute_y"]) <= 2
    covers_width = layer["width"] >= canvas_width * 0.9
    covers_height = layer["height"] >= canvas_height * 0.9
    return near_origin and covers_width and covers_height and area_ratio >= 0.8


def number_or(value, fallback):
    return value if isinstance(value, (int, float)) else fallback


if __name__ == "__main__":
    main()
