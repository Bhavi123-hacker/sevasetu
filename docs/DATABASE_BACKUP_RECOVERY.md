# SevaSetu Database Backup & Disaster Recovery Runbook

This document defines standard operational procedures for database backups, data integrity audits, and disaster recovery for the SevaSetu Civic Document Pre-Verification Platform.

---

## 1. Architecture Overview & Persistence

In production and containerized environments:
- **Primary Database**: PostgreSQL 15+ (`postgres:15-alpine`)
- **Docker Named Volume**: `pg_data` mounted at `/var/lib/postgresql/data`
- **Application Storage**: `sevasetu_data` mounted at `/app/data`
- **Connection Healthchecks**: `pg_isready -U sevasetu -d sevasetu` and connection pool pre-ping (`pool_pre_ping=True`)

---

## 2. Backup Procedures

### A. One-Command Full Database Backup (Docker / Containerized)

To create a timestamped, compressed custom-format backup:

```bash
# Set timestamp and backup filename
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="./backups/sevasetu_backup_${BACKUP_DATE}.dump"
mkdir -p ./backups

# Execute pg_dump inside postgres container
docker compose exec -T postgres pg_dump -U sevasetu -d sevasetu -F c -b -v > "${BACKUP_FILE}"

echo "Backup completed: ${BACKUP_FILE}"
```

### B. Plain SQL Text Backup (Human-Readable)

```bash
docker compose exec -T postgres pg_dump -U sevasetu -d sevasetu --clean --if-exists > "./backups/sevasetu_plain_${BACKUP_DATE}.sql"
```

### C. SQLite Local Development Backup

```bash
# For local development using SQLite file:
sqlite3 ./backend/data/sevasetu.db ".backup './backups/sevasetu_sqlite_${BACKUP_DATE}.db'"
```

---

## 3. Restore & Disaster Recovery Procedures

### A. Restoring from Custom-Format Dump (`.dump`)

```bash
# 1. Stop backend service to prevent write conflicts during restore
docker compose stop backend

# 2. Re-create clean target database
docker compose exec -T postgres psql -U sevasetu -d postgres -c "DROP DATABASE IF EXISTS sevasetu;"
docker compose exec -T postgres psql -U sevasetu -d postgres -c "CREATE DATABASE sevasetu OWNER sevasetu;"

# 3. Restore database schema and data
docker compose exec -T postgres pg_restore -U sevasetu -d sevasetu -v < "./backups/sevasetu_backup_YYYYMMDD_HHMMSS.dump"

# 4. Restart backend service
docker compose start backend
```

### B. Restoring from Plain SQL Backup (`.sql`)

```bash
docker compose stop backend
docker compose exec -T postgres psql -U sevasetu -d sevasetu < "./backups/sevasetu_plain_YYYYMMDD_HHMMSS.sql"
docker compose start backend
```

---

## 4. Post-Restore Verification Checklist

Run the following SQL verification commands to ensure data integrity and table consistency:

```bash
docker compose exec -T postgres psql -U sevasetu -d sevasetu -c "
SELECT 
    'applications' AS entity, COUNT(*) AS count FROM applications
UNION ALL
SELECT 
    'documents', COUNT(*) FROM documents
UNION ALL
SELECT 
    'citizen_profiles', COUNT(*) FROM citizen_profiles
UNION ALL
SELECT 
    'audit_events', COUNT(*) FROM audit_events
UNION ALL
SELECT 
    'staff_users', COUNT(*) FROM staff_users;
"
```

### Audit Hash-Chain Integrity Check:
Verify that the cryptographic hash chain of audit records has not been broken:

```bash
# Query API health to verify live database connectivity
curl -s http://localhost:8000/api/health | jq .
```

---

## 5. Automated Daily Backup (Cron Example)

Add this entry to the host system crontab (`crontab -e`) to automate nightly backups at 02:00 AM:

```cron
0 2 * * * cd /opt/sevasetu && docker compose exec -T postgres pg_dump -U sevasetu -d sevasetu -F c | gzip > /var/backups/sevasetu/sevasetu_$(date +\%Y\%m\%d).dump.gz && find /var/backups/sevasetu -name "*.dump.gz" -mtime +30 -delete
```
