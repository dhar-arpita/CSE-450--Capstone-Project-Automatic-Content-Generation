# backup_qdrant.py — run manually to snapshot + download the Qdrant collection
import os
import requests
from datetime import datetime
from core.config import qdrant_client, COLLECTION_NAME

# 1. Create the snapshot on the server
snap = qdrant_client.create_snapshot(collection_name=COLLECTION_NAME)
print("Snapshot created:", snap.name)

# 2. Download it to disk with a timestamped filename
url = f"{os.environ['QDRANT_URL']}/collections/{COLLECTION_NAME}/snapshots/{snap.name}"
r = requests.get(url, headers={"api-key": os.environ["QDRANT_API_KEY"]})
r.raise_for_status()

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
out_path = f"{COLLECTION_NAME}_{stamp}.snapshot"
with open(out_path, "wb") as f:
    f.write(r.content)

print(f"Downloaded backup → {out_path} ({len(r.content)} bytes)")

# 3. Delete the server-side snapshot — we have the local copy now
qdrant_client.delete_snapshot(
    collection_name=COLLECTION_NAME,
    snapshot_name=snap.name,
)
print(f"Deleted server-side snapshot: {snap.name}")