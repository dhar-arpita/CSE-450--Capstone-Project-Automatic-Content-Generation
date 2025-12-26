from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from urllib.parse import quote_plus


# 1. Your RAW password (paste it exactly as is)
raw_password = "123qweasdZXC@!@#@"

# 2. Safely encode it (converts @ to %40, etc.)
encoded_password = quote_plus(raw_password)

# 3. Construct the URL using the encoded password
# Note the 'f' before the string to allow {encoded_password} inside
SQLALCHEMY_DATABASE_URL = f"postgresql://postgres.ipxhxnmbevyxpsmzuhun:{encoded_password}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

# We add "sslmode=require" for secure cloud connections
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"sslmode": "require"})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db=SessionLocal()
    try:
        yield db
    finally:
        db.close()