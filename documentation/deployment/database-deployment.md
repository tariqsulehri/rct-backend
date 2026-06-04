# PostgreSQL Database Deployment & Access Guide

## Document Information

| Item               | Value                       |
| ------------------ | --------------------------- |
| Database           | devops_platform             |
| PostgreSQL Version | 17.5                        |
| Operating System   | Ubuntu                      |
| Application Stack  | Node.js, React/Vite, Prisma |
| Environment        | Development / UAT           |
| Last Updated       | June 2026                   |

---

# 1. Objective

This document provides step-by-step instructions for:

* Installing PostgreSQL 17.5 on Ubuntu
* Configuring remote database access
* Migrating an existing database from a Mac development machine
* Configuring application connectivity
* Managing Prisma migrations
* Performing backups and restores
* Following deployment best practices

---

# 2. Target Architecture

```text
Developer Machine (Mac)
│
├── Node.js API
├── React/Vite Frontend
├── Prisma Migrations
│
└──────────────► PostgreSQL 17.5
                 Ubuntu VM
```

Database becomes the central source of truth while application development continues locally.

---

# 3. Prerequisites

## Ubuntu Server

Recommended:

| Resource | Recommendation |
| -------- | -------------- |
| CPU      | 2 vCPU         |
| RAM      | 4 GB Minimum   |
| Storage  | 50 GB SSD      |
| OS       | Ubuntu 22.04+  |

## Tools Required

```bash
sudo apt update
sudo apt install -y wget curl gnupg2 lsb-release ca-certificates
```

---

# 4. Install PostgreSQL 17.5

## Add PostgreSQL Repository

```bash
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc \
| sudo gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
```

```bash
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
http://apt.postgresql.org/pub/repos/apt \
$(lsb_release -cs)-pgdg main" \
| sudo tee /etc/apt/sources.list.d/pgdg.list
```

```bash
sudo apt update
```

## Install PostgreSQL

```bash
sudo apt install -y \
postgresql-17 \
postgresql-client-17 \
postgresql-contrib
```

## Verify Installation

```bash
psql --version
```

Expected:

```text
psql (PostgreSQL) 17.5
```

---

# 5. Verify PostgreSQL Service

## Check Cluster

```bash
sudo pg_lsclusters
```

Expected:

```text
17 main 5432 online postgres
```

## Check Service Status

```bash
sudo systemctl status postgresql
```

## Enable Service

```bash
sudo systemctl enable postgresql
```

---

# 6. Create Database and User

Connect:

```bash
sudo -u postgres psql
```

Create User:

```sql
CREATE ROLE appuser LOGIN PASSWORD 'StrongPassword';
```

Create Database:

```sql
CREATE DATABASE devops_platform OWNER appuser;
```

Verify:

```sql
\l
```

Exit:

```sql
\q
```

---

# 7. Configure Remote Access

## Update postgresql.conf

Edit:

```bash
sudo nano /etc/postgresql/17/main/postgresql.conf
```

Find:

```ini
#listen_addresses = 'localhost'
```

Change to:

```ini
listen_addresses='*'
```

---

## Update pg_hba.conf

Edit:

```bash
sudo nano /etc/postgresql/17/main/pg_hba.conf
```

Add:

```ini
host    all    all    0.0.0.0/0    scram-sha-256
host    all    all    ::/0         scram-sha-256
```

---

## Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

---

## Verify Listening Address

```bash
sudo ss -tunlp | grep 5432
```

Expected:

```text
0.0.0.0:5432
[::]:5432
```

---

# 8. Export Database from Mac

Create backup:

```bash
pg_dump \
-U postgres \
-F c \
-b \
-v \
-f devops_platform.backup \
devops_platform
```

Generated file:

```text
devops_platform.backup
```

---

# 9. Transfer Backup to Ubuntu

```bash
scp devops_platform.backup ubuntu@SERVER_IP:/tmp
```

Example:

```bash
scp devops_platform.backup ubuntu@192.168.1.100:/tmp
```

---

# 10. Restore Database

Restore using:

```bash
pg_restore \
-h localhost \
-U appuser \
-d devops_platform \
--no-owner \
-v \
/tmp/devops_platform.backup
```

---

# 11. Validate Database

Connect:

```bash
psql \
-h localhost \
-U appuser \
-d devops_platform
```

Verify tables:

```sql
\dt
```

Verify data:

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM employees;
SELECT COUNT(*) FROM organizations;
SELECT COUNT(*) FROM "_prisma_migrations";
```

Expected:

```text
users                4
employees           30
organizations        1
_prisma_migrations   2
```

---

# 12. Configure Application Connection

Update environment file:

```env
DATABASE_URL=postgresql://appuser:StrongPassword@SERVER_IP:5432/devops_platform
```

Example:

```env
DATABASE_URL=postgresql://appuser:StrongPassword@192.168.1.100:5432/devops_platform
```

---

# 13. Verify Prisma

Check migration status:

```bash
npx prisma migrate status
```

Pull schema:

```bash
npx prisma db pull
```

Generate client:

```bash
npx prisma generate
```

---

# 14. Database Migration Workflow

## Local Development

Create migration:

```bash
npx prisma migrate dev --name add_new_feature
```

Commit changes:

```bash
git add .
git commit -m "Add migration"
git push
```

---

## Deployment

SSH into server:

```bash
ssh ubuntu@SERVER_IP
```

Pull latest code:

```bash
git pull
```

Install dependencies:

```bash
npm install
```

Run migrations:

```bash
npx prisma migrate deploy
```

Restart application:

```bash
pm2 restart all
```

---

# 15. Backup Strategy

## Manual Backup

```bash
pg_dump \
-U appuser \
-F c \
-f backup_$(date +%F).dump \
devops_platform
```

---

## Backup Directory

```bash
mkdir -p /opt/backups/postgres
```

---

## Daily Cron Backup

Open crontab:

```bash
crontab -e
```

Add:

```bash
0 1 * * * /opt/scripts/postgres-backup.sh
```

---

## Retention Policy

| Backup Type | Retention |
| ----------- | --------- |
| Daily       | 7 Days    |
| Weekly      | 4 Weeks   |
| Monthly     | 12 Months |

---

# 16. Connection Testing

## Test Database Port

```bash
nc -vz SERVER_IP 5432
```

Expected:

```text
Connection succeeded
```

---

## Test PostgreSQL Connection

```bash
psql \
-h SERVER_IP \
-U appuser \
-d devops_platform
```

Expected:

```text
devops_platform=>
```

---

# 17. Security Recommendations

## Temporary Development Access

```ini
host all all 0.0.0.0/0 scram-sha-256
```

Suitable for temporary development and testing.

---

## Recommended Long-Term Access

Use one of the following:

* SSH Tunnel
* VPN
* Tailscale
* WireGuard

Avoid exposing PostgreSQL directly to the internet in production.

---

# 18. Deployment Checklist

Before every deployment:

* Database backup completed
* Application code pulled
* Dependencies installed
* Prisma migration executed
* Application restarted
* Smoke test completed

---

# 19. Success Criteria

Deployment is considered successful when:

* PostgreSQL service is online
* Database is accessible remotely
* Prisma migrations are synchronized
* Application connects successfully
* Data integrity is verified
* Backup process is operational

---

# 20. Current Environment Verification

| Item                       | Status             |
| -------------------------- | ------------------ |
| PostgreSQL Installed       | Complete           |
| PostgreSQL Version         | 17.5               |
| Database Created           | Complete           |
| Remote Access Enabled      | Complete           |
| Database Restored          | Complete           |
| Prisma Migrations Restored | Complete           |
| Application Connection     | Pending Validation |
| Backup Automation          | Pending            |
| CI/CD Integration          | Future Phase       |

```
```
