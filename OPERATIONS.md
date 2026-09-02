# SevaSetu — Operations, Monitoring & Disaster Recovery Guide

This operations guide covers ongoing system monitoring, database lifecycle management, automated backup/recovery, and incident response for **SevaSetu**.

---

## 1. System Health & Observability

### Health Check Probes
- **Public Health Endpoint**: `GET /api/health`
  - Returns `status: ok`, database engine connection status, provider statuses, and timestamp.
  - Used for container orchestrator liveness and readiness probes.
- **Operations Subsystem Diagnostic**: `GET /api/operations/system-health`
  - Inspects real database latency (ms), upload directory write permissions, Resend API configuration, and SHA-256 audit ledger integrity without leaking internal secrets.
- **Real-Time Operational Impact Telemetry**: `GET /api/impact/metrics`
  - Computes live operational throughput: application pipeline, statutory SLA compliance %, average turnaround, document classification distribution, officer workloads, and citizen feedback sentiment.

---

## 2. Database Schema Management & Reconciliation

SevaSetu includes automatic runtime schema reconciliation in `backend/app/database.py`:
1. On startup, `ensure_schema_upgrades()` inspects all ORM models via SQLAlchemy reflection.
2. If new columns, indexes, or tables are detected, it applies non-destructive `ALTER TABLE` operations automatically.
3. `verify_schema_integrity()` executes a fast-fail query validation across all critical entities before accepting HTTP traffic.

---

## 3. Backup & Disaster Recovery Procedures

### Automated SQLite / PostgreSQL Backup
A verified backup of the database is automatically created prior to any major schema upgrade or administrative maintenance:
```bash
# SQLite instance backup
sqlite3 backend/data/sevasetu.db ".backup 'backend/data/sevasetu_backup_$(date +%Y%m%d_%H%M%S).db'"

# PostgreSQL instance backup
pg_dump -U sevasetu_user -h localhost sevasetu | gzip > "sevasetu_pg_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Point-in-Time Database Restoration
```bash
# Restore PostgreSQL database
gunzip -c sevasetu_pg_backup_20260901.sql.gz | psql -U sevasetu_user -h localhost -d sevasetu

# Restore SQLite database
cp backend/data/sevasetu_backup_20260901.db backend/data/sevasetu.db
```

---

## 4. DPDP Retention & Archival Policies

SevaSetu enforces purpose-bound document retention:
1. **Active Operational Stage**: Full citizen documents and scans are maintained during active review and statutory interview.
2. **Post-Determination Stage**: Retention duration is governed by configured statutory service rules (default 90 days).
3. **Retention Redaction Sweep**: Redacts citizen document binary storage while permanently preserving the SHA-256 cryptographic audit event stream.
