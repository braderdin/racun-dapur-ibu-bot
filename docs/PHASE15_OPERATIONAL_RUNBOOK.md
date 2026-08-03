# PHASE 15 OPERATIONAL RUNBOOK

## Autonomous Dual-Channel Affiliate Bot, Telegram QA Audit & Realtime Catalog

**Version:** 1.0  
**Date:** 2026-08-03  
**Project:** @RacunDapurIbu  
**Classification:** Operational Documentation

---

## 📋 TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Prerequisites & Access](#3-prerequisites--access)
4. [Daily Operations](#4-daily-operations)
5. [Telegram QA Audit Procedures](#5-telegram-qa-audit-procedures)
6. [Emergency Deletion Triggers](#6-emergency-deletion-triggers)
7. [System Failover Protocols](#7-system-failover-protocols)
8. [Monitoring & Alerting](#8-monitoring--alerting)
9. [Troubleshooting Guide](#9-troubleshooting-guide)
10. [Maintenance Schedule](#10-maintenance-schedule)
11. [Rollback Procedures](#11-rollback-procedures)
12. [Contact & Escalation](#12-contact--escalation)

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose

This runbook provides comprehensive operational procedures for the Phase 15 Autonomous Dual-Channel Affiliate Bot system. The system automates the complete pipeline from product discovery to social media posting with real-time Telegram QA audit capabilities.

### 1.2 Core Components

| Component                         | Technology                     | Purpose                                                |
| --------------------------------- | ------------------------------ | ------------------------------------------------------ |
| **Lazada Live Scraper**           | TypeScript/Node.js             | Fetch trending deals from Lazada Open API              |
| **B2 WebP Uploader**              | TypeScript/Sharp               | Compress images to WebP, upload to B2 with trust badge |
| **Vector RAG Copywriter**         | OpenRouter AI + Upstash Vector | Generate Malaysian-style copy for X & Facebook         |
| **Edge Link Shortener**           | Upstash Redis                  | Create short affiliate links with UTM tracking         |
| **Social Poster Engine**          | X API + Meta Graph API         | Dual-channel posting with anti-spam delays             |
| **Telegram QA Inspector**         | Telegram Bot API               | Visual audit reports with inline keyboard controls     |
| **Telegram Webhook Handler**      | Cloudflare Workers             | Emergency action callbacks (delete, override)          |
| **Supabase Realtime Broadcaster** | Supabase Realtime              | WebSocket notifications to Vercel web portal           |
| **Live Showcase Feed**            | Next.js/React                  | Real-time catalog display with flash sale timers       |
| **GitHub Actions Cron**           | GitHub Actions                 | 24/7 autonomous scheduling during peak MYT hours       |

### 1.3 Dual-Channel Posting Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    X (TWITTER) THREAD                            │
├─────────────────────────────────────────────────────────────────┤
│  TWEET 1: HD Photo + Hook Copy (NO LINKS)                      │
│  ↓ Auto-reply after 1s                                         │
│  TWEET 2: Affiliate Shortlink + CTA                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   FACEBOOK PAGE POST                             │
├─────────────────────────────────────────────────────────────────┤
│  MAIN POST: HD Photo + Storytelling Copy (NO LINKS)            │
│  ↓ Auto-comment after 3-8s jitter delay                        │
│  COMMENT 1: Affiliate Shortlink + CTA                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Peak Hours Schedule (MYT = UTC+8)

| Window          | MYT Time      | UTC Time      | Frequency    |
| --------------- | ------------- | ------------- | ------------ |
| **Lunch Peak**  | 12:30 - 14:00 | 04:30 - 06:00 | Every 30 min |
| **Dinner Peak** | 20:30 - 22:30 | 12:30 - 14:30 | Every 30 min |

---

## 2. ARCHITECTURE DIAGRAM

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  LAZADA OPEN    │────▶│  LAZADA LIVE     │────▶│  PRODUCT DATA      │
│  API            │     │  SCRAPER         │     │  (Filtered >30%    │
└─────────────────┘     └──────────────────┘     │  discount, >4.5★)  │
                                                  └─────────┬──────────┘
                                                            │
                                                  ┌─────────▼──────────┐
                                                  │  B2 WEBP UPLOADER  │
                                                  │  (Compress + Badge)│
                                                  └─────────┬──────────┘
                                                            │
                                                  ┌─────────▼──────────┐
                                                  │  VECTOR RAG        │
                                                  │  COPYWRITER        │
                                                  │  (X Hook + FB      │
                                                  │  Storytelling)     │
                                                  └─────────┬──────────┘
                                                            │
                                    ┌───────────────────────┼───────────────────────┐
                                    ▼                       ▼                       ▼
                           ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
                           │ EDGE LINK       │     │ SOCIAL POSTER   │     │ TELEGRAM QA     │
                           │ SHORTENER       │     │ ENGINE          │     │ INSPECTOR       │
                           │ (racun.ibu.my/  │     │ (X Thread + FB  │     │ (Visual Audit   │
                           │  r/:code)       │     │  Post+Comment)  │     │  + Inline KB)   │
                           └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
                                    │                       │                       │
                                    ▼                       ▼                       ▼
                           ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
                           │ LINK HEALTH     │     │ TELEGRAM        │     │ SUPABASE        │
                           │ GUARD           │     │ WEBHOOK         │     │ REALTIME        │
                           │ (Pre-post check)│     │ (Emergency      │     │ BROADCASTER     │
                           └─────────────────┘     │  Actions)       │     │ (WebSocket to   │
                                                   └─────────────────┘     │  Vercel Web)   │
                                                                           └─────────────────┘
```

---

## 3. PREREQUISITES & ACCESS

### 3.1 Required Access Credentials

| Service               | Credential                                  | Storage Location             |
| --------------------- | ------------------------------------------- | ---------------------------- |
| **Lazada API**        | App Key, Secret, Member ID, User Token      | GitHub Secrets / `.dev.vars` |
| **X (Twitter) API**   | API Key, Secret, Bearer Token, Access Token | GitHub Secrets / `.dev.vars` |
| **Meta Facebook API** | App ID, Secret, Page ID, Page Access Token  | GitHub Secrets / `.dev.vars` |
| **Upstash Redis**     | REST URL, REST Token                        | GitHub Secrets / `.dev.vars` |
| **Upstash QStash**    | URL, Token, Signing Keys                    | GitHub Secrets / `.dev.vars` |
| **OpenRouter AI**     | Base URL, API Key, Model                    | GitHub Secrets / `.dev.vars` |
| **Supabase**          | URL, Service Role Key, Anon Key             | GitHub Secrets / `.dev.vars` |
| **Backblaze B2**      | 3x Account IDs & Keys                       | GitHub Secrets / `.dev.vars` |
| **Cloudflare**        | Account ID, API Token                       | GitHub Secrets / `.dev.vars` |
| **Telegram Bot**      | Bot Token, Chat ID                          | GitHub Secrets / `.dev.vars` |
| **Discord Webhook**   | Webhook URL                                 | GitHub Secrets / `.dev.vars` |

### 3.2 Required Tools

```bash
# Local development
npm install -g wrangler@latest
npm install -g vercel@latest

# Database
# Note: No native psql - use Node.js pg scripts

# Monitoring
curl, jq (for API testing)
```

### 3.3 Environment Files

```bash
# Local development
.dev.vars          # Local secrets (gitignored)
.env.local         # Local overrides (gitignored)

# Production (GitHub Secrets)
# All credentials stored in GitHub Repository Secrets
```

---

## 4. DAILY OPERATIONS

### 4.1 Automated Cron Execution

The system runs automatically via GitHub Actions during peak hours:

**Workflow:** `.github/workflows/bot-247-autonomous-cron.yml`

**Schedule:**

- 04:30, 05:00, 05:30, 06:00 UTC (12:30-14:00 MYT)
- 12:30, 13:00, 13:30, 14:00, 14:30 UTC (20:30-22:30 MYT)

**Manual Trigger:**

```bash
# Via GitHub CLI
gh workflow run bot-247-autonomous-cron.yml -f run_type=manual

# Or via GitHub Web UI: Actions → Bot 24/7 Autonomous Cron → Run workflow
```

### 4.2 Manual Pipeline Execution

For testing or manual runs:

```bash
# Dry-run mode (default - no actual posting)
node bin/run-live-bot-e2e.js --mode=dry-run --limit=3

# Live mode (actual posting - USE WITH CAUTION)
node bin/run-live-bot-e2e.js --mode=live --limit=1

# Autonomous mode (peak hours logic)
node bin/run-live-bot-e2e.js --mode=autonomous --peak-hours

# Skip specific stages
node bin/run-live-bot-e2e.js --skip=poster,telegram

# Verbose output
node bin/run-live-bot-e2e.js -v
```

### 4.3 Health Checks

```bash
# Worker health
curl https://<worker-url>/health

# Supabase connection
node bin/test-db.cjs

# Redis connection
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" $UPSTASH_REDIS_REST_URL/ping

# Telegram bot
curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe
```

---

## 5. TELEGRAM QA AUDIT PROCEDURES

### 5.1 Receiving Audit Reports

When a product completes the pipeline, the **Telegram QA Inspector** sends a visual audit report to the configured chat ID containing:

1. **Product Image** - HD WebP preview with trust badge
2. **Product Details** - Title, ID, category, pricing, discount
3. **X (Twitter) Copy** - Hook, CTA, cultural adaptation
4. **Facebook Copy** - Hook, CTA, cultural adaptation
5. **Links** - Short URL, original affiliate URL
6. **Live Post Links** - Direct links to published posts (if live mode)
7. **Inline Keyboard Controls** - Action buttons

### 5.2 Inline Keyboard Actions

| Button                 | Callback Data                      | Action                    |
| ---------------------- | ---------------------------------- | ------------------------- |
| 🗑️ Emergency Delete X  | `delete_post:twitter:{productId}`  | Delete Twitter thread     |
| 🗑️ Emergency Delete FB | `delete_post:facebook:{productId}` | Delete Facebook post      |
| ✅ Audit Override      | `audit_override:{productId}`       | Mark as manually approved |
| 🔗 View Shortlink      | `view_shortlink:{productId}`       | Show shortlink analytics  |
| 📊 View Analytics      | `view_analytics:{productId}`       | Show performance metrics  |
| 📤 Export Data         | `export_data:{productId}`          | Export audit data         |

### 5.3 Audit Workflow

```
1. RECEIVE audit report in Telegram
2. REVIEW:
   - Image quality & trust badge visibility
   - Copy tone (Malaysian "Racun Dapur Ibu" persona)
   - Link correctness (short URL redirects properly)
   - Cultural appropriateness
3. DECIDE:
   ✅ APPROVE: Click "Audit Override" → marks approved
   ❌ REJECT: Click "Emergency Delete X/FB" → removes posts
   🔄 RETRY: Click "Retry" → re-queues for reposting
4. MONITOR: Check analytics after 1-2 hours
```

### 5.4 Audit Status Values

| Status           | Icon | Meaning                        |
| ---------------- | ---- | ------------------------------ |
| `pending`        | ⏳   | Awaiting review                |
| `approved`       | ✅   | Manually approved via override |
| `rejected`       | ❌   | Rejected, posts deleted        |
| `override`       | 🔄   | Manual override applied        |
| `deleted`        | 🗑️   | Posts deleted via emergency    |
| `emergency_stop` | 🛑   | All activity stopped           |

---

## 6. EMERGENCY DELETION TRIGGERS

### 6.1 When to Use Emergency Delete

**Immediate triggers (no hesitation):**

- ❌ Wrong product image posted
- ❌ Incorrect pricing displayed
- ❌ Broken affiliate links
- ❌ Offensive/inappropriate copy generated
- ❌ Duplicate posts detected
- ❌ Platform policy violation risk

**Judgment triggers (review first):**

- ⚠️ Low engagement after 30 minutes
- ⚠️ Negative comments/reactions
- ⚠️ Competitor complaint
- ⚠️ Brand safety concern

### 6.2 Emergency Delete Procedure

**Via Telegram (Recommended - Fastest):**

1. Open audit report in Telegram
2. Click **🗑️ Emergency Delete X** or **🗑️ Emergency Delete FB**
3. Confirm deletion in callback response
4. Verify post removal on platform

**Via CLI (If Telegram unavailable):**

```bash
# Delete Twitter post
curl -X POST https://api.twitter.com/2/tweets/{tweet_id} \
  -H "Authorization: Bearer $X_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Delete Facebook post
curl -X DELETE "https://graph.facebook.com/v18.0/{post_id}" \
  -H "Authorization: Bearer $META_PAGE_ACCESS_TOKEN"
```

**Via Database (Audit trail):**

```sql
-- Mark as deleted in audit logs
UPDATE live_post_audit_logs
SET audit_status = 'deleted',
    deleted_at = NOW(),
    audit_notes = 'Emergency deletion via CLI'
WHERE product_id = 'PRODUCT_ID';
```

### 6.3 Post-Deletion Verification

1. Check platform directly (Twitter/Facebook)
2. Verify audit log status updated to `deleted`
3. Check Telegram for confirmation message
4. Monitor for any residual engagement

---

## 7. SYSTEM FAILOVER PROTOCOLS

### 7.1 Component Failure Matrix

| Component             | Failure Symptom           | Failover Action                                  | Recovery Time |
| --------------------- | ------------------------- | ------------------------------------------------ | ------------- |
| **Lazada API**        | 429/5xx errors, timeout   | Use cached products, retry with backoff          | 5-15 min      |
| **B2 Upload**         | Account quota exceeded    | Auto-switch to next B2 account (1→2→3)           | <1 min        |
| **OpenRouter AI**     | Rate limit, model down    | Fallback to Tier 2 (Gemini) → Tier 3 (Heuristic) | <30 sec       |
| **Upstash Redis**     | Connection timeout        | Use local memory cache, queue writes             | <1 min        |
| **X API**             | Rate limit, auth error    | Queue tweets, retry after reset                  | 15 min - 1 hr |
| **Facebook API**      | Rate limit, token expiry  | Refresh token, queue posts                       | 5-30 min      |
| **Telegram Bot**      | Webhook timeout           | Retry with exponential backoff                   | <1 min        |
| **Supabase**          | Connection pool exhausted | Use direct IPv4 connection                       | <5 min        |
| **Cloudflare Worker** | Deploy failure            | Rollback to previous version                     | 2-5 min       |

### 7.2 AI Fallback Chain (3-Tier)

```
Tier 1: OpenRouter AI (Primary)
    ↓ Failure/Timeout (3s)
Tier 2: Google Gemini / Groq API
    ↓ Failure/Timeout (3s)
Tier 3: Local Heuristic Rule-Based State Machine
    ↓ Always works
Emergency: Pre-defined template fallbacks
```

### 7.3 Manual Failover Commands

```bash
# Switch B2 account manually
# Edit .dev.vars or GitHub Secrets to change active account

# Force AI fallback tier
# Set OPENROUTER_MODEL to "gemini" or "heuristic" in env

# Bypass rate limiter (emergency only)
# Set REDIS_RATE_LIMIT_BYPASS=true in env

# Emergency stop all posting
# Set EMERGENCY_STOP=true in GitHub Secrets → triggers workflow cancellation
```

### 7.4 Data Consistency Checks

```bash
# Verify audit log integrity
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await supabase.from('live_post_audit_logs').select('*').eq('audit_status', 'pending');
console.log('Pending audits:', data?.length);
"

# Check for orphaned posts (posted but no audit log)
# Run via Supabase SQL editor
```

---

## 8. MONITORING & ALERTING

### 8.1 Key Metrics to Monitor

| Metric                    | Target       | Alert Threshold | Dashboard                |
| ------------------------- | ------------ | --------------- | ------------------------ |
| **Pipeline Success Rate** | >95%         | <90%            | GitHub Actions / Discord |
| **API Latency (P95)**     | <2s          | >5s             | Cloudflare Workers       |
| **Redis Memory**          | <50MB        | >80MB           | Upstash Console          |
| **B2 Storage**            | <9GB/account | >8GB            | Backblaze Dashboard      |
| **Supabase Storage**      | <50MB        | >40MB           | Supabase Dashboard       |
| **Telegram Delivery**     | 100%         | Any failure     | Telegram Bot API         |
| **Post Engagement (CTR)** | >3%          | <1%             | Audit Dashboard          |

### 8.2 Alert Channels

| Channel                | Purpose                         | Configuration                             |
| ---------------------- | ------------------------------- | ----------------------------------------- |
| **Discord #bot-logs**  | Real-time alerts, failures      | `DISCORD_WEBHOOK_URL` secret              |
| **Telegram Bot**       | Audit reports, emergency alerts | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` |
| **GitHub Actions**     | Workflow status, cron failures  | Built-in notifications                    |
| **Cloudflare Workers** | Worker errors, CPU limits       | Workers dashboard                         |

### 8.3 Daily Summary Report

Automatically sent via Telegram at 23:00 MYT containing:

- Total products processed
- Successful/failed posts per platform
- Total clicks & estimated revenue
- Top performing categories
- Error summary
- System health status

---

## 9. TROUBLESHOOTING GUIDE

### 9.1 Common Issues & Solutions

#### Issue: "Lazada API returns 401 Unauthorized"

```bash
# Check credentials
echo $LAZADA_APP_KEY
echo $LAZADA_APP_SECRET

# Verify token expiry
# Lazada tokens expire - regenerate via Lazada Open Platform

# Test API directly
curl "https://api.lazada.com.my/rest/v2/product/get?product_id=TEST&app_key=$LAZADA_APP_KEY&sign=..."
```

#### Issue: "B2 Upload fails with 403 Forbidden"

```bash
# Check account credentials
# Verify bucket is PRIVATE (not public)
# Check account quota (9GB limit per account)
# Rotate to next account: BACKBLAZE_B2_ACCOUNT_ID_2
```

#### Issue: "OpenRouter AI returns 429 Rate Limited"

```bash
# Check OPENROUTER_API_KEY validity
# Verify model name: OPENROUTER_MODEL=openrouter/free
# Enable fallback: Tier 2 (Gemini) auto-activates
# Add delay: 3s between requests (built-in)
```

#### Issue: "Telegram webhook not receiving callbacks"

```bash
# Verify webhook URL
curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo

# Set webhook (if missing)
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://your-worker.your-subdomain.workers.dev/telegram/webhook"

# Check Cloudflare Worker logs
wrangler tail --format=pretty
```

#### Issue: "Supabase Realtime not broadcasting"

```bash
# Check Supabase Realtime enabled
# In Supabase Dashboard: Database → Replication → Enable for live_post_audit_logs

# Verify service role key has realtime permissions
# Check channel subscription in Vercel web portal
```

#### Issue: "GitHub Actions workflow fails"

```bash
# Check workflow logs
gh run view --log

# Common fixes:
# 1. Secret not set → Add to GitHub Repository Secrets
# 2. Node version mismatch → Use node-version: "18"
# 3. Timeout → Increase timeout-minutes
# 4. Dependency install fails → Check package-lock.json
```

### 9.2 Debug Commands

```bash
# Full pipeline dry-run with verbose output
node bin/run-live-bot-e2e.js -v --mode=dry-run --limit=1

# Test individual services
node -e "
const { LazadaLiveScraper } = require('./src/services/lazada-live-scraper');
const scraper = new LazadaLiveScraper(require('./env'));
scraper.fetchTrendingDeals().then(console.log);
"

# Check Redis keys
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/keys/*"

# View audit logs
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('live_post_audit_logs').select('*').order('created_at', {ascending: false}).limit(10).then(console.log);
"
```

---

## 10. MAINTENANCE SCHEDULE

### 10.1 Daily (Automated)

- ✅ GitHub Actions cron runs during peak hours
- ✅ Database backup to B2 (via `daily-db-backup.js`)
- ✅ Audit log cleanup (pg_cron job at 03:00 UTC)
- ✅ Health check pings

### 10.2 Weekly (Manual - Monday 10:00 MYT)

- [ ] Review audit dashboard for trends
- [ ] Check B2 storage usage per account
- [ ] Verify Supabase storage <50MB
- [ ] Review Discord/Telegram alert history
- [ ] Update marketing hooks in Vector RAG (if needed)
- [ ] Check API rate limit quotas

### 10.3 Monthly (Manual - 1st of month)

- [ ] Rotate API keys/secrets (Lazada, X, Meta, OpenRouter)
- [ ] Review and optimize PostgreSQL indexes
- [ ] Analyze conversion rates by category
- [ ] Update fallback copy templates
- [ ] Review and update runbook
- [ ] Backup Supabase database (full)

### 10.4 Quarterly

- [ ] Load test with simulated peak traffic
- [ ] Disaster recovery drill
- [ ] Security audit of all credentials
- [ ] Performance optimization review
- [ ] Update dependencies (`npm audit fix`)

---

## 11. ROLLBACK PROCEDURES

### 11.1 Cloudflare Worker Rollback

```bash
# List deployments
wrangler deployments list

# Rollback to specific deployment
wrangler rollback <deployment-id>

# Or redeploy previous version
git checkout <previous-tag>
wrangler deploy
```

### 11.2 Vercel Web Portal Rollback

```bash
# Via Vercel CLI
vercel rollback <deployment-url>

# Or via Vercel Dashboard
# Deployments → Select previous → Promote to Production
```

### 11.3 Database Migration Rollback

```sql
-- Disable pg_cron job
SELECT cron.unschedule('purge-old-audit-logs-daily');

-- Drop new objects (CAREFUL - data loss)
DROP VIEW IF EXISTS v_audit_dashboard;
DROP VIEW IF EXISTS v_audit_performance;
DROP FUNCTION IF EXISTS get_audit_stats;
DROP FUNCTION IF EXISTS purge_old_audit_logs;
DROP TABLE IF EXISTS live_post_audit_logs;
```

### 11.4 Emergency Feature Flags

Set in GitHub Secrets / `.dev.vars` to disable features instantly:

| Flag                              | Effect                        |
| --------------------------------- | ----------------------------- |
| `EMERGENCY_STOP=true`             | Stops all posting immediately |
| `DISABLE_LAZADA_SCRAPER=true`     | Uses cached products only     |
| `DISABLE_AI_COPYWRITER=true`      | Uses template fallbacks only  |
| `DISABLE_SOCIAL_POSTING=true`     | Runs pipeline but no posting  |
| `DISABLE_TELEGRAM_AUDIT=true`     | Skips audit notifications     |
| `DISABLE_REALTIME_BROADCAST=true` | No WebSocket updates          |

---

## 12. CONTACT & ESCALATION

### 12.1 Escalation Levels

| Level              | Trigger                      | Response Time   | Contact                          |
| ------------------ | ---------------------------- | --------------- | -------------------------------- |
| **L1 - Automated** | Single pipeline failure      | Auto-retry (3x) | System self-heals                |
| **L2 - Alert**     | 3+ consecutive failures      | <15 min         | Discord #bot-logs + Telegram     |
| **L3 - Critical**  | Platform API down, data loss | <1 hour         | Chip Besar (Direct)              |
| **L4 - Disaster**  | Complete system outage       | Immediate       | Chip Besar + Infrastructure team |

### 12.2 Key Contacts

| Role             | Name               | Contact              | Availability   |
| ---------------- | ------------------ | -------------------- | -------------- |
| **System Owner** | Chip Besar         | Telegram / Discord   | 24/7           |
| **DevOps**       | -                  | GitHub Issues        | Business hours |
| **Database**     | Supabase Support   | support@supabase.io  | 24/7 (Pro)     |
| **Edge/Worker**  | Cloudflare Support | Cloudflare Dashboard | Business hours |
| **Redis/QStash** | Upstash Support    | support@upstash.com  | Business hours |

### 12.3 Incident Report Template

When escalating, provide:

```
**INCIDENT REPORT - @RacunDapurIbu Phase 15**

**Timestamp:** [ISO 8601]
**Severity:** [L1/L2/L3/L4]
**Component:** [Scraper/Uploader/Copywriter/Poster/Telegram/Realtime]
**Error Message:** [Exact error]
**Stack Trace:** [If available]
**Steps to Reproduce:** [1, 2, 3]
**Impact:** [Users affected, revenue loss, data loss]
**Mitigation Attempted:** [What was tried]
**Current Status:** [Ongoing/Resolved/Workaround]
**Logs/Links:** [GitHub Actions URL, Cloudflare logs, etc.]
```

---

## 📝 APPENDICES

### Appendix A: Environment Variable Reference

```bash
# Core APIs
LAZADA_APP_KEY=
LAZADA_APP_SECRET=
LAZADA_MEMBER_ID=
LAZADA_USER_TOKEN=
X_API_KEY=
X_API_KEY_SECRET=
X_BEARER_TOKEN=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
META_APP_ID=
META_APP_SECRET=
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=

# AI & Vector
OPENROUTER_BASE_URL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=

# Database & Storage
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
DATABASE_URL=
BACKBLAZE_B2_ACCOUNT_ID_1=
BACKBLAZE_B2_ACCOUNT_KEY_1=
BACKBLAZE_B2_ACCOUNT_ID_2=
BACKBLAZE_B2_ACCOUNT_KEY_2=
BACKBLAZE_B2_ACCOUNT_ID_3=
BACKBLAZE_B2_ACCOUNT_KEY_3=

# Infrastructure
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
DISCORD_WEBHOOK_URL=
SHORTLINK_DOMAIN=racun.ibu.my
WORKER_URL=

# Feature Flags
EMERGENCY_STOP=false
DISABLE_LAZADA_SCRAPER=false
DISABLE_AI_COPYWRITER=false
DISABLE_SOCIAL_POSTING=false
DISABLE_TELEGRAM_AUDIT=false
DISABLE_REALTIME_BROADCAST=false
```

### Appendix B: Useful SQL Queries

```sql
-- Recent audit logs with performance
SELECT * FROM v_audit_dashboard WHERE created_at > NOW() - INTERVAL '24 hours';

-- Performance by category
SELECT * FROM v_audit_performance WHERE date > NOW() - INTERVAL '7 days';

-- Get audit stats for last 30 days
SELECT * FROM get_audit_stats(30);

-- Find unhealthy links
SELECT * FROM live_post_audit_logs WHERE audit_status = 'rejected' ORDER BY created_at DESC;

-- Storage usage
SELECT pg_size_pretty(pg_total_relation_size('live_post_audit_logs'));
```

### Appendix C: API Endpoint Reference

| Endpoint                  | Method | Purpose                     |
| ------------------------- | ------ | --------------------------- |
| `/health`                 | GET    | Worker health check         |
| `/cron/trigger`           | POST   | Manual cron trigger         |
| `/telegram/webhook`       | POST   | Telegram callback handler   |
| `/api/telemetry/stats`    | GET    | System metrics (protected)  |
| `/api/realtime/broadcast` | POST   | Internal broadcast endpoint |

---

**END OF RUNBOOK**

_This document should be reviewed and updated monthly. Last updated: 2026-08-03_
