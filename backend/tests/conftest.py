"""
Sets DATABASE_URL to an isolated test database BEFORE anything imports
app.main — database.py reads this env var at import time, so it has to
be set before the first `from app... import` anywhere in the test
session, not inside a fixture that runs after collection.
"""
import os
import sys
from pathlib import Path

TEST_DB_PATH = Path(__file__).parent / "test.db"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
sys.path.insert(0, str(Path(__file__).parent.parent))
