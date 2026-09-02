# SevaSetu — Production Deployment & Infrastructure Guide

This guide details deployment options for **SevaSetu** across Docker Compose, Bare-Metal Linux servers, Cloud Virtual Machines (AWS/GCP/Azure), and Kubernetes environments.

---

## 1. Quick Start: Production Docker Compose

### Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+
- Minimum 2 vCPUs, 4 GB RAM, 20 GB Disk

### Step-by-Step Deployment

1. **Clone Repository & Enter Directory**:
   ```bash
   git clone https://github.com/Bhavi123-hacker/sevasetu.git
   cd sevasetu
   ```

2. **Configure Production Environment**:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Configure the following critical environment variables:
   ```env
   ENVIRONMENT=production
   DATABASE_URL=postgresql://sevasetu_user:SecurePostgresPass2026!@postgres:5432/sevasetu
   SECRET_KEY=generate-a-strong-64-character-hex-secret-key-here
   CORS_ORIGINS=https://sevasetu.gov.in,https://app.sevasetu.gov.in
   RESEND_API_KEY=re_your_official_resend_key
   RESEND_FROM_EMAIL=notifications@sevasetu.gov.in
   FIREBASE_PROJECT_ID=your-firebase-project-id
   ```

3. **Build and Launch Containers**:
   ```bash
   docker compose up -d --build
   ```

4. **Verify Container Health**:
   ```bash
   docker compose ps
   ```
   Ensure `postgres`, `backend`, `frontend`, and `ollama` show `Up (healthy)`.

5. **Verify System Health Endpoint**:
   ```bash
   curl -s http://localhost:8000/api/health | jq
   ```

---

## 2. Bare-Metal & Linux VM Deployment

### System Architecture
- **Reverse Proxy**: Nginx 1.24+ with TLS 1.3 / SSL Certificates (Let's Encrypt / DigiCert)
- **Application Server**: Gunicorn / Uvicorn workers running FastAPI (Python 3.11+)
- **Frontend Server**: Nginx serving pre-compiled static Vite assets
- **Database Engine**: PostgreSQL 15+ with daily automated pg_dump backups

### Nginx Configuration Template (`/etc/nginx/sites-available/sevasetu`)
```nginx
server {
    listen 80;
    server_name sevasetu.yourdomain.gov.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sevasetu.yourdomain.gov.in;

    ssl_certificate /etc/letsencrypt/live/sevasetu.yourdomain.gov.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sevasetu.yourdomain.gov.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline';" always;

    # Frontend Static Distribution
    location / {
        root /var/www/sevasetu/frontend-react/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 15M;
    }
}
```

### Systemd Backend Service (`/etc/systemd/system/sevasetu-backend.service`)
```ini
[Unit]
Description=SevaSetu Civic Verification API Backend
After=network.target postgresql.service

[Service]
User=sevasetu
Group=sevasetu
WorkingDirectory=/var/www/sevasetu/backend
EnvironmentFile=/var/www/sevasetu/backend/.env
ExecStart=/var/www/sevasetu/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 3. Database Migration & Initialization

On initial deployment or startup, SevaSetu automatically runs dynamic schema reconciliation in `backend/app/database.py`:
- Checks all tables, indexes, and constraints.
- Idempotently reconciles missing columns and foreign keys.
- Seeds default authoritative service definitions and 84 statutory requirement rules.
- Creates initial staff accounts if unseeded (`admin1`, `officer1`, `senior_officer1`).

---

## 4. Disaster Recovery & Backup Configuration

Configure an automated daily backup cron job:
```bash
# /etc/cron.daily/sevasetu-backup
#!/bin/bash
BACKUP_DIR="/var/backups/sevasetu"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL database
pg_dump -U sevasetu_user sevasetu | gzip > "$BACKUP_DIR/sevasetu_db_$TIMESTAMP.sql.gz"

# Retain backups for 30 days
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -delete
```
