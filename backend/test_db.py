# test_db.py
from settings import engine

try:
    conn = engine.connect()
    print("Supabase is alive!")
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")