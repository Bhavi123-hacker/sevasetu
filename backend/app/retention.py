"""
CLI Runner for SevaSetu Data Retention & Privacy Management.
Usage:
    python -m app.retention --dry-run
    python -m app.retention --execute
"""
import argparse
import sys
from .database import SessionLocal
from .pipeline.retention import run_retention_cleanup


def main():
    parser = argparse.ArgumentParser(description="SevaSetu Data Retention Policy Manager")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Preview records eligible for retention cleanup")
    parser.add_argument("--execute", action="store_true", help="Perform actual deletion/redaction of expired records")
    args = parser.parse_args()

    dry_run = not args.execute
    print(f"=== SEVASETU DATA RETENTION ENGINE (Dry-Run: {dry_run}) ===")
    
    db = SessionLocal()
    try:
        res = run_retention_cleanup(db, dry_run=dry_run)
        print(f"Document retention limit: {res['document_retention_days']} days")
        print(f"Application retention limit: {res['application_retention_days']} days")
        print(f"Expired documents identified: {res['expired_documents_found']}")
        print(f"Archivable applications identified: {res['archivable_applications_found']}")
        if not dry_run:
            print(f"Documents successfully purged/redacted: {res['documents_purged']}")
        else:
            print("No database records modified (Dry-run mode active).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
