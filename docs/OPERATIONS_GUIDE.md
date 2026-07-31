# Corporate Operations & Maintenance Runbook

**Phase 6: E2E Live Testing & 24/7 Autonomous Bot Launch**

## Overview

This document provides comprehensive operational guidelines for maintaining the @RacunDapurIbu dual-channel bot ecosystem in production. It covers daily operations, maintenance procedures, troubleshooting, and incident response for all Phase 6 services.

## Table of Contents

1. [System Overview](#system-overview)
2. [Daily Operations](#daily-operations)
3. [Weekly Maintenance](#weekly-maintenance)
4. [Monthly Maintenance](#monthly-maintenance)
5. [Incident Response](#incident-response)
6. [Monitoring and Alerting](#monitoring-and-alerting)
7. [Security Operations](#security-operations)
8. [Backup and Recovery](#backup-and-recovery)
9. [Performance Optimization](#performance-optimization)
10. [Change Management](#change-management)
11. [Documentation and Knowledge Base](#documentation-and-knowledge-base)

## System Overview

### Architecture Components

- **Cloudflare Workers** - Main processing engine with edge CDN
- **Upstash Redis** - Anti-repeat protection (5-day TTL), rate limiting
- **Upstash Vector** - Semantic similarity checking (>0.85 threshold)
- **Upstash QStash** - Peak-hour scheduling (12:30-14:00 & 20:30-22:30 MYT)
- **Backblaze B2 Storage** - 27GB across 3 accounts with auto-switching
- **Supabase Postgres** - Database with realtime broadcasts
- **Vercel Web Portal** - Next.js application with dual-buy buttons
- **OpenRouter AI** - 3-tier resilient AI content generation

### Service Dependencies

1. **Frontend** -> **API Gateway** -> **Core Services**
2. **Mobile App** -> **API Gateway** -> **Core Services**
3. **Admin Dashboard** -> **API Gateway** -> **Core Services**

### Key Metrics

- **Deal Processing**: < 2 seconds
- **Social Posting**: 4 posts/day (X), 4 posts/day (Facebook)
- **API Response**: 95%+ success rate
- **System Uptime**: 99.9% minimum

## Daily Operations

### Morning Checklist (6:00 AM - 10:00 AM)

#### System Health Verification

```bash
# Check service health
./bin/run-e2e-simulation.js --health-only

# Verify all services are operational
./bin/verify-vercel-build.js

# Check for any failed jobs
./bin/check-qstash-jobs.js
```

#### Log Analysis

```bash
# Review system logs for errors
tail -n 100 /var/log/racun-dapur-ibu-bot/errors.log

# Check for performance issues
tail -n 100 /var/log/racun-dapur-ibu-bot/performance.log

# Verify social media posting logs
tail -n 50 /var/log/racun-dapur-ibu-bot/social-posts.log
```

#### Backup Verification

```bash
# Ensure recent backups exist
ls -la /backup/racun-dapur-ibu-bot/

# Verify backup integrity
./bin/validate-backups.sh
```

#### Cache and Session Management

```bash
# Clear expired cache entries
redis-cli FLUSHDB

# Clean up temporary files
find /tmp -name "*.tmp" -delete
find /var/tmp -name "racun-*" -delete
```

### Midday Monitoring (12:00 PM - 4:00 PM)

#### Peak Hour Operations

```bash
# Monitor QStash peak hour jobs
./bin/check-peak-hour-jobs.js

# Verify B2 storage switching
./bin/check-b2-usage.sh

# Track social media performance
./bin/analytics-collector.sh
```

#### Performance Optimization

```bash
# Adjust cache settings based on usage
./bin/optimize-cache.sh

# Fine-tune rate limiting
./bin/tune-rate-limiter.sh

# Monitor vector similarity performance
./bin/check-vector-performance.sh
```

#### Security Review

```bash
# Verify no exposed secrets
./bin/security-scan.sh

# Check authentication status
./bin/auth-status-check.sh

# Validate access controls
./bin/access-control-check.sh
```

### Evening Operations (5:00 PM - 9:00 PM)

#### System Cleanup

```bash
# Archive old logs
./bin/archive-logs.sh

# Compress temporary files
./bin/compress-temp-files.sh

# Update system metrics
./bin/update-metrics.sh
```

#### Nightly Backups

```bash
# Create complete system backup
./bin/create-full-backup.sh

# Verify backup integrity
./bin/verify-backup-integrity.sh

# Update disaster recovery procedures
./bin/update-dr-procedures.sh
```

#### Security Patching

```bash
# Apply security updates
./bin/apply-security-updates.sh

# Validate patch installation
./bin/validate-patches.sh

# Check for vulnerabilities
./nmap --script vuln -sT localhost > /tmp/security-scan.txt
```

## Weekly Maintenance

### Weekend Maintenance (Friday - Sunday)

#### Infrastructure Review

```bash
# Review infrastructure costs
./bin/cost-analysis.sh

# Verify all services are properly configured
./bin/validate-all-configs.sh

# Check resource utilization trends
./bin/analyze-resource-trends.sh
```

#### Performance Tuning

```bash
# Optimize database queries
./bin/optimize-database-queries.sh

# Fine-tune vector similarity settings
./bin/tune-vector-settings.sh

# Adjust rate limiting parameters
./bin/optimize-rate-limiting.sh
```

#### Service Updates

```bash
# Update all services to latest versions
./bin/update-all-services.sh

# Verify service compatibility
./bin/test-service-compatibility.sh

# Test service interconnections
./bin/test-service-interconnections.sh
```

### Monthly Maintenance (Last Weekend of Month)

#### System Audit

```bash
# Comprehensive system audit
./bin/system-audit.sh --comprehensive

# Verify compliance requirements
./bin/check-compliance-requirements.sh

# Validate security controls
./bin/validate-security-controls.sh
```

#### Capacity Planning

```bash
# Project future growth requirements
./bin/project-future-requirements.sh

# Optimize infrastructure for upcoming changes
./app/plan-infrastructure-upgrades.sh

# Review cost optimization opportunities
./bin/identify-cost-savings.sh
```

#### Documentation Updates

```bash
# Update operational procedures
./bin/update-operational-procedures.sh

# Revise troubleshooting guides
./bin/update-troubleshooting-guides.sh

# Update runbook with new procedures
./bin/update-runbook.sh
```

## Incident Response

### Severity Classification

#### Level 1: Minor Issues

- **Symptoms**: Non-critical functionality degradation
- **Examples**: Slow response times (< 2 seconds), minor UI issues
- **Response**: Log and monitor, fix during next maintenance window

#### Level 2: Moderate Issues

- **Symptoms**: Partial service degradation
- **Examples**: Limited feature availability, increased error rates
- **Response**: Immediate investigation, implement fixes within 4 hours

#### Level 3: Major Issues

- **Symptoms**: Significant service disruption
- **Examples**: Social media posting failures, database connectivity issues
- **Response**: Emergency procedures, dedicated response team

#### Level 4: Critical Issues

- **Symptoms**: Complete service outage
- **Examples**: All posting channels down, data loss
- **Response**: Business continuity procedures, executive notification

### Incident Response Procedures

#### Level 2 and Below Response

1. **Immediate Actions**:
   - Activate monitoring and logging
   - Document incident details
   - Implement temporary workarounds if available
   - Notify affected stakeholders

2. **Investigation**:
   - Identify root cause
   - Assess impact scope
   - Develop fix strategy
   - Estimate recovery time

3. **Resolution**:
   - Implement fix
   - Test fix effectiveness
   - Decommission temporary workarounds
   - Document lessons learned

#### Level 3 and Above Response

1. **Emergency Procedures**:
   - Activate disaster recovery
   - Implement fix immediately
   - Notify executive team
   - Update all stakeholders

2. **Communication**:
   - Establish crisis communication channels
   - Regular status updates every 30 minutes
   - Coordinate with external partners
   - Document all communications

3. **Recovery**:
   - Restore affected services
   - Verify system integrity
   - Perform comprehensive testing
   - Conduct post-incident review

### Service-Specific Incident Response

#### Social Media Posting Failures

1. Check X API authentication status
2. Verify Facebook Page permissions
3. Validate message content formatting
4. Test retry mechanisms

#### Database Issues

1. Verify Supabase connection status
2. Check for query timeouts
3. Validate data integrity
4. Implement rollback procedures

#### Storage Issues

1. Check B2 account status
2. Verify WebP compression
3. Test upload/download processes
4. Validate auto-switching logic

## Monitoring and Alerting

### Key Metrics

#### Performance Metrics

- **Response Time**: P99 < 2 seconds
- **Success Rate**: > 95%
- **Throughput**: 100 deals/hour
- **Uptime**: 99.9%

#### Business Metrics

- **Posts Per Day**: 8 total (4 X + 4 Facebook)
- **Deals Processed**: 100 per day
- **Click-Through Rate**: > 1%
- **Storage Usage**: < 90% of capacity

#### System Metrics

- **CPU Usage**: < 80%
- **Memory Usage**: < 90%
- **Disk I/O**: < 100MB/s
- **Network**: < 1Gbps

### Alert Configuration

#### Critical Alerts

```yaml
# Critical: Social media posting failures
alert:
  title: Social Media Posting Failure
  severity: critical
  condition: service.Down("social-posting")
  notification: [email, slack, pagerduty]
  escalation: 5 minutes

# High: Database connectivity issues
alert:
  title: Database Connectivity Issue
  severity: high
  condition: service.Degraded("database")
  notification: [email, slack]
  escalation: 10 minutes

# Medium: Performance degradation
alert:
  title: Performance Degradation
  severity: medium
  condition: responseTime.P95 > 2000
  notification: [slack]
  escalation: 20 minutes
```

#### Escalation Matrix

- **Level 1**: Self-recovery, log and monitor
- **Level 2**: Immediate response, implement fixes
- **Level 3**: Emergency procedures, dedicated team
- **Level 4**: Business continuity, executive notification

### Monitoring Tools

```bash
# Health check endpoints
GET https://api.racun.ibu.my/health/live
GET https://api.racun.ibu.my/health/

# Performance metrics
GET https://api.racun.ibu.my/metrics/performance
GET https://api.racun.ibu.my/metrics/business

# Service status
GET https://api.racun.ibu.my/status/services
GET https://api.racun.ibu.my/status/health
```

## Security Operations

### Access Control

- **Multi-Factor Authentication**: Required for all admin access
- **Role-Based Access**: Clear separation of duties
- **API Key Management**: Secure storage and rotation
- **Session Management**: Timeout and logging

### Threat Detection

```bash
# Monitor for suspicious activities
./bin/detect-anomalies.sh

# Check for unauthorized access
./bin/check-unauthorized-access.sh

# Validate security policies
./bin/validate-security-policies.sh
```

### Incident Response

```bash
# Immediate containment
./bin/contain-security-incident.sh

# Investigation and analysis
./bin/investigate-security-incident.sh

# Recovery and remediation
./bin/recover-from-security-incident.sh
```

## Backup and Recovery

### Backup Strategy

- **Daily**: Incremental backups of all critical data
- **Weekly**: Full system backup
- **Monthly**: Incremental backup verification

### Recovery Procedures

```bash
# Step 1: Activate disaster recovery
./bin/activate-disaster-recovery.sh

# Step 2: Restore critical services
./bin/restore-critical-services.sh

# Step 3: Validate system integrity
./bin/validate-system-integrity.sh

# Step 4: Resume operations
./bin/resume-operations.sh
```

### Backup Verification

```bash
# Verify backup integrity
./bin/verify-backup-integrity.sh

# Test restoration procedures
./bin/test-restoration-procedures.sh

# Update backup schedules
./bin/update-backup-schedules.sh
```

## Performance Optimization

### Cache Optimization

```bash
# Monitor cache performance
./bin/monitor-cache-performance.sh

# Optimize cache settings
./bin/optimize-cache-settings.sh

# Clear expired cache entries
./bin/clear-expired-cache.sh
```

### Database Optimization

```bash
# Analyze slow queries
./bin/analyze-slow-queries.sh

# Optimize database connections
./bin/optimize-database-connections.sh

# Update database statistics
./bin/update-database-statistics.sh
```

### Application Optimization

```bash
# Fine-tune application settings
./bin/optimize-application-settings.sh

# Monitor application performance
./bin/monitor-application-performance.sh

# Adjust caching strategies
./bin/adjust-caching-strategies.sh
```

## Change Management

### Change Approval

```yaml
change:
  title: Update AI Model Configuration
  description: Upgrade from OpenRouter v1 to v2
  impact: Low
  risk: Medium
  required_approval: manager
  backup_required: true
  rollout_strategy: canary
```

### Deployment Process

1. **Planning**: Document changes and assess impact
2. **Approval**: Obtain necessary approvals
3. **Testing**: Validate in staging environment
4. **Deployment**: Implement in production
5. **Monitoring**: Track performance and health
6. **Rollback**: Prepare for quick rollback if needed

### Rollback Procedures

```bash
# Quick rollback for critical issues
./bin/quick-rollback.sh

# Gradual rollback for non-critical changes
./bin/gradual-rollback.sh

# Final rollback if needed
./bin/final-rollback.sh
```

## Documentation and Knowledge Base

### Documentation Structure

```
docs/
├── operations-guide.md          # Current document
├── troubleshooting/              # Troubleshooting guides
├── api-documentation/             # API documentation
├── architecture/                 # System architecture
├── deployment/                   # Deployment procedures
├── maintenance/                  # Maintenance procedures
└── security/                     # Security procedures
```

### Knowledge Base Articles

- **Health Check Procedures**: How to troubleshoot health check failures
- **Performance Tuning**: Guidelines for optimizing system performance
- **Security Patches**: Procedures for applying security updates
- **Backup Procedures**: Steps for backup and restoration
- **Incident Response**: Detailed response procedures for various incident types

## Conclusion

This Corporate Operations & Maintenance Runbook provides comprehensive guidance for operating the @RacunDapurIbu dual-channel bot ecosystem in production. It emphasizes reliability, security, and continuous improvement while providing clear procedures for maintenance, monitoring, and incident response.

The system is designed for high availability and performance, with robust backup and recovery procedures to ensure business continuity. Regular maintenance and monitoring are essential for maintaining system health and optimizing performance.

---

_Document Version: 1.0_
_Last Updated: July 31, 2026_
_Prepared by: Racun Dapur Ibu Operations Team_
