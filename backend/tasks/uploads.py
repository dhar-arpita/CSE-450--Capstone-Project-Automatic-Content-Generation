# tasks/uploads.py — hand an uploaded file from the web tier to a worker.
#
# A Celery message should carry a job id, not megabytes of PDF, so the web tier
# writes the upload to disk and the task receives only its path. The directory
# must be storage BOTH containers can see: in dev that is the ./backend bind
# mount (/app/uploads); in production it must be a shared volume mounted into
# the backend and worker services alike.

import os
import uuid

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"
)


def save(data: bytes, prefix: str, filename: str) -> str:
    """Write `data` under UPLOAD_DIR with a unique name and return its path."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(filename or "")[1].lower()
    path = os.path.join(UPLOAD_DIR, f"{prefix}_{uuid.uuid4().hex}{ext}")
    with open(path, "wb") as f:
        f.write(data)
    return path


def read(path):
    """Return the bytes at `path`, or None when no file was attached."""
    if not path:
        return None
    with open(path, "rb") as f:
        return f.read()


def discard(path):
    """Delete a handed-off file once its job is finished. Missing is fine."""
    if not path:
        return
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
