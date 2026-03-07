"""mitmproxy addon that captures API traffic to JSONL files.

Usage: mitmdump --mode reverse:http://target:port -p 8080 -s capture.py
"""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

from mitmproxy import http

CAPTURES_DIR = Path("/captures")
SKIP_EXTENSIONS = {".js", ".css", ".ico", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".woff", ".woff2", ".ttf", ".map"}

session_file = CAPTURES_DIR / f"session-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.jsonl"


def response(flow: http.HTTPFlow) -> None:
    path = flow.request.path.split("?")[0]

    if any(path.endswith(ext) for ext in SKIP_EXTENSIONS):
        return

    if not path.startswith("/api/"):
        return

    req = flow.request
    resp = flow.response
    if resp is None:
        return

    duration_ms = round((flow.response.timestamp_end - flow.request.timestamp_start) * 1000)

    req_body = None
    req_content_type = req.headers.get("content-type", "")
    if req.content:
        if "json" in req_content_type:
            try:
                req_body = json.loads(req.content)
            except (json.JSONDecodeError, UnicodeDecodeError):
                req_body = req.content.decode("utf-8", errors="replace")
        elif "multipart" in req_content_type:
            req_body = f"<multipart {len(req.content)} bytes>"
        else:
            try:
                req_body = req.content.decode("utf-8", errors="replace")
            except Exception:
                req_body = f"<binary {len(req.content)} bytes>"

    resp_body = None
    resp_content_type = resp.headers.get("content-type", "")
    if resp.content:
        if "json" in resp_content_type:
            try:
                resp_body = json.loads(resp.content)
            except (json.JSONDecodeError, UnicodeDecodeError):
                resp_body = resp.content.decode("utf-8", errors="replace")
        elif "text/event-stream" in resp_content_type or "text" in resp_content_type:
            resp_body = resp.content.decode("utf-8", errors="replace")
        elif len(resp.content) > 100_000:
            resp_body = f"<binary {len(resp.content)} bytes>"
        else:
            try:
                resp_body = resp.content.decode("utf-8", errors="replace")
            except Exception:
                resp_body = f"<binary {len(resp.content)} bytes>"

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "method": req.method,
        "path": req.path,
        "query": dict(req.query) if req.query else None,
        "status": resp.status_code,
        "durationMs": duration_ms,
        "requestContentType": req_content_type,
        "requestBody": req_body,
        "responseContentType": resp_content_type,
        "responseBody": resp_body,
    }

    CAPTURES_DIR.mkdir(parents=True, exist_ok=True)
    with open(session_file, "a") as f:
        f.write(json.dumps(record, default=str) + "\n")
