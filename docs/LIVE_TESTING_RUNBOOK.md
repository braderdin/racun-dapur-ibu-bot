# Live Testing Runbook - Phase 12

**Document Version:** 1.0
**Created:** 2026-08-02
**Purpose:** Comprehensive guide for manual auditing, link verification, and emergency post deletion protocols for Lazada Live Affiliate Comment Engine

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Live Test Execution](#live-test-execution)
4. [Manual Auditing Procedures](#manual-auditing-procedures)
5. [Link Verification](#link-verification)
6. [Emergency Post Deletion](#emergency-post-deletion)
7. [Troubleshooting](#troubleshooting)
8. [Post-Test Actions](#post-test-actions)
9. [Appendices](#appendices)

## 1. Overview

This runbook provides comprehensive procedures for executing, auditing, and managing live tests of the Lazada Live Affiliate Comment Engine. It covers the complete pipeline from product fetching to social media posting and Telegram audit notifications.

### Key Features

- **Dual-Platform Testing**: X (Twitter) and Facebook Page
- **Telegram Integration**: Real-time visual audit notifications with inline keyboard controls
- **Emergency Controls**: Manual post deletion and audit override capabilities
- **Link Health Verification**: Pre-post validation of affiliate cloaked links
- **Comprehensive Logging**: Full audit trail for all test activities

## 2. Prerequisites

### 2.1 System Requirements

```bash
# Required environment variables
LAZADA_APP_KEY
LAZADA_APP_SECRET
LAZADA_MEMBER_ID
LAZADA_USER_TOKEN
TWITTER_API_KEY
TWITTER_API_SECRET
TWITTER_ACCESS_TOKEN
TWITTER_ACCESS_SECRET
FACEBOOK_APP_ID
FACEBOOK_APP_SECRET
FACEBOOK_PAGE_ACCESS_TOKEN
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
CLOAK_DOMAIN
OPENROUTER_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### 2.2 Software Dependencies

- Node.js 18+
- npm (not pnpm)
- TypeScript 5+
- All project dependencies installed (`npm install`)

### 2.3 Access Requirements

- **Telegram Bot Access**: Bot must be added to target chat/group
- **Social Media Accounts**: Valid X (Twitter) and Facebook Page accounts
- **Database Access**: Supabase project with proper permissions
- **Storage Access**: Backblaze B2 storage buckets configured

## 3. Live Test Execution

### 3.1 Quick Start

```bash
# Dry run test (recommended first)
node bin/run-live-lazada-test.js --product-id laz_001 --dry-run

# Live test with thread
node bin/run-live-lazada-test.js --product-id laz_001 --tweet-id 123456789

# Live test with Facebook comment
node bin/run-live-lazada-test.js --product-id laz_001 --facebook-post-id 987654321

# Full live test
node bin/run-live-lazada-test.js --product-id laz_001 --tweet-id 123456789 --facebook-post-id 987654321
```

### 3.2 Test Modes

#### Dry Run Mode

- **Purpose**: Test pipeline without posting to social media
- **Benefits**: Validate link generation, image processing, and audit workflows
- **Usage**: `--dry-run` flag or `mode=dry` in webhook

#### Live Mode

- **Purpose**: Execute complete pipeline with actual social media posts
- **Warnings**: Posts will be published to your accounts
- **Requirements**: Valid social media credentials and permissions

### 3.3 Webhook Execution

```bash
# Execute via Telegram webhook
GET /live-test?productId=laz_001&mode=dry&userId=telegram_user

# Example response
{
  "success": true,
  "mode": "dry_run",
  "productId": "laz_001",
  "simulation": {
    "steps": [...],
    "timeline": [...],
    "resources": [...],
    "expectedOutcomes": [...]
  },
  "message": "Dry run completed successfully. No actual posts were made.",
  "nextSteps": [...]
}
```

## 4. Manual Auditing Procedures

### 4.1 Visual Audit Review

#### 4.1.1 Telegram Audit Channel

1. **Access**: Join the designated Telegram chat for audit notifications
2. **Review**: Check for visual audit messages with inline keyboard
3. **Actions**: Use inline buttons for:
   - `🗑️ Delete Post`: Emergency post deletion
   - `🔄 Audit Override`: Manual audit override
   - `👁️ View Details`: Full post details
   - `📤 Export Data`: Export audit data

#### 4.1.2 Audit Message Format

```
🔍 **AUDIT POST LAZADA - 2026-08-02 14:30:45**

📱 **POST INFORMATION**
• Platform: dual
• Post ID: post_12345
• Product: Air Fryer 5L Non-Stick Touch Screen Kitchen Appliance
• Price: RM 119.00
• Discount: 60%
• Rating: 4.5/5
• Stock: available

💬 **COMMENT INFORMATION**
• Comment ID: comment_67890
• Comment Text: Bolehpilih nak grab promo Lazada kat link ni tau! 👇
• Affiliate Link: https://r.racundapuribu.com/lz-laz001-1234567890-abcdef
• Engagement: 0

🖼️ **IMAGE INFORMATION**
• Image URL: https://racun.ibu.my/images/lazada-laz001-12345.webp
• Image Status: ✅ Available

⚡ **QUICK ACTIONS**
• /delete_post - Delete this post
• /audit_override - Manual audit override
• /view_details - View full details
• /export_data - Export audit data

📊 **AUDIT STATUS**
• Status: ✅ COMPLETED
• Source: Lazada Live Fetcher
• Channel: Dual-Platform (X & Facebook)
• Timestamp: 2026-08-02 14:30:45
```

### 4.2 Manual Post Verification

#### 4.2.1 X (Twitter) Verification

1. **Check Thread**: Verify both Tweet 1 (hook + image) and Tweet 2 (affiliate reply)
2. **Validate Links**: Ensure cloaked affiliate links work correctly
3. **Review Content**: Check for proper Malaysian language and tone
4. **Engagement**: Monitor likes, retweets, and replies

#### 4.2.2 Facebook Page Verification

1. **Check Main Post**: Verify storytelling caption and HD image
2. **Validate Comment**: Ensure affiliate link comment is visible
3. **Review Engagement**: Check likes, comments, and shares
4. **Link Validation**: Test affiliate link functionality

## 5. Link Verification

### 5.1 Pre-Post Link Health Check

#### 5.1.1 Manual Link Verification

```bash
# Use the live link checker utility
node -e "
const { LiveLinkChecker } = require('./src/services/live-link-checker');
const checker = new LiveLinkChecker();

async function checkLink(link, productId) {
  const result = await checker.checkLinkHealth(link, productId);
  console.log(JSON.stringify(result, null, 2));
}

checkLink('https://r.racundapuribu.com/lz-laz001-1234567890-abcdef', 'laz_001');
"
```

#### 5.1.2 Batch Link Verification

```bash
# Check multiple links
node -e "
const { LiveLinkChecker } = require('./src/services/live-link-checker');
const checker = new LiveLinkChecker();

async function checkBatchLinks() {
  const links = [
    'https://r.racundapuribu.com/lz-laz001-1234567890-abcdef',
    'https://r.racundapuribu.com/lz-laz002-2345678901-ghijkl',
  ];
  const result = await checker.checkBatchLinks(links, 'laz_001');
  console.log(JSON.stringify(result, null, 2));
}

checkBatchLinks();
"
```

### 5.2 Link Status Indicators

| Status      | Description               | Action Required         |
| ----------- | ------------------------- | ----------------------- |
| `healthy`   | Link returns HTTP 200/302 | ✅ Proceed with posting |
| `unhealthy` | Server or client error    | 🔄 Fix link and retry   |
| `timeout`   | Request timeout           | ⏱️ Wait and retry       |
| `error`     | Network or system error   | 🚨 Investigate and fix  |

## 6. Emergency Post Deletion

### 6.1 Manual Post Deletion

#### 6.1.1 Via Telegram

1. **Trigger**: Use `/delete_post` command or inline keyboard button
2. **Validation**: System checks user permissions and post status
3. **Execution**: Deletes post from X (Twitter) and Facebook
4. **Confirmation**: Sends deletion confirmation to user

#### 6.1.2 Via CLI

```bash
# Emergency deletion (requires proper authentication)
# This would be implemented in a separate admin tool
```

### 6.2 Audit Override

#### 6.2.1 Purpose

- Override automated audit decisions
- Manually mark posts as approved/rejected
- Bypass automated validation for special cases

#### 6.2.2 Process

1. **Initiate**: Use `/audit_override` command or inline button
2. **Review**: Manual review of post content and metadata
3. **Decision**: Approve, reject, or modify post
4. **Record**: Log override action in audit trail

## 7. Troubleshooting

### 7.1 Common Issues and Solutions

#### 7.1.1 Link Generation Failures

**Problem**: Cloaked links not generating correctly

**Solutions**:

- Check Redis connectivity
- Verify environment variables
- Validate product data format
- Check rate limiting

#### 7.1.2 Social Media API Errors

**Problem**: Posts failing to publish

**Solutions**:

- Verify API credentials
- Check rate limits
- Validate post content length
- Ensure proper permissions

#### 7.1.3 Image Processing Failures

**Problem**: Images not processing or uploading

**Solutions**:

- Check Backblaze B2 credentials
- Verify image URL accessibility
- Ensure Sharp.js is installed
- Check file size limits

### 7.2 Error Codes

| Code  | Description           | Solution               |
| ----- | --------------------- | ---------------------- |
| `400` | Bad Request           | Check input parameters |
| `401` | Unauthorized          | Verify API credentials |
| `403` | Forbidden             | Check user permissions |
| `404` | Not Found             | Verify resource exists |
| `429` | Too Many Requests     | Wait and retry later   |
| `500` | Internal Server Error | Check logs and retry   |

## 8. Post-Test Actions

### 8.1 Data Review

#### 8.1.1 Audit Log Review

1. **Access**: Check Supabase `live_post_audit_logs` table
2. **Filter**: By date, platform, or status
3. **Analyze**: Success rates, error patterns, performance metrics

#### 8.1.2 Telegram Chat Review

1. **Check Messages**: Review all audit notifications
2. **Validate Actions**: Ensure all inline keyboard actions work
3. **Document**: Record any issues or successes

### 8.2 Performance Analysis

#### 8.2.1 Pipeline Performance

- **Lazada Fetch**: Average response time
- **Image Processing**: Upload and conversion times
- **Social Media Posting**: API response times
- **Audit Notifications**: Telegram message delivery times

#### 8.2.2 Success Metrics

- **Posts Published**: Total number of successful posts
- **Engagement Rates**: Average likes, comments, shares
- **Link Click-through Rates**: Affiliate link performance
- **Error Rates**: Percentage of failed operations

## 9. Appendices

### 9.1 Environment Variables Reference

```bash
# Required for Phase 12
LAZADA_APP_KEY=your_lazada_app_key
LAZADA_APP_SECRET=your_lazada_app_secret
LAZADA_MEMBER_ID=your_member_id
LAZADA_USER_TOKEN=your_user_token

TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

CLOAK_DOMAIN=r.racundapuribu.com
OPENROUTER_API_KEY=your_openrouter_api_key

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 9.2 Command Reference

#### 9.2.1 CLI Commands

```bash
# Dry run test
node bin/run-live-lazada-test.js --product-id <id> --dry-run

# Live test with thread
node bin/run-live-lazada-test.js --product-id <id> --tweet-id <tweet_id>

# Live test with Facebook comment
node bin/run-live-lazada-test.js --product-id <id> --facebook-post-id <post_id>

# Full live test
node bin/run-live-lazada-test.js --product-id <id> --tweet-id <tweet_id> --facebook-post-id <post_id>
```

#### 9.2.2 Webhook Endpoints

```
GET /live-test?productId=<id>[&tweetId=<id>][&facebookPostId=<id>][&mode=dry][&userId=<user>]
POST /live-test (with JSON body)
```

### 9.3 File Structure Reference

```
src/services/
├── lazada-live-fetcher.ts          # Lazada API integration
├── lazada-image-proxy.ts           # Image processing and B2 upload
├── link-cloaker-lazada.ts          # Affiliate link generation
├── ai-persona-comment.ts           # AI comment generation
├── twitter-commenter.ts            # X (Twitter) posting
├── facebook-commenter.ts           # Facebook posting
├── telegram-interactive-audit.ts   # Telegram audit notifications
├── post-deletion-service.ts        # Emergency post deletion
└── lazada-live-orchestrator.ts    # Complete pipeline orchestration

src/routes/
├── telegram-webhook.ts             # Telegram webhook handler
└── live-test-handler.ts            # Live test HTTP handler

src/utils/
└── lazada-image-proxy.ts           # Image proxy utilities

bin/
└── run-live-lazada-test.js         # CLI test runner

supabase/migrations/
└── 20260802000001_phase12_live_audit_logs.sql  # Database schema

docs/
└── LIVE_TESTING_RUNBOOK.md         # This documentation
```

### 9.4 Version History

| Version | Date       | Changes         | Author       |
| ------- | ---------- | --------------- | ------------ |
| 1.0     | 2026-08-02 | Initial release | AI Assistant |

## Conclusion

This runbook provides comprehensive guidance for executing, auditing, and managing live tests of the Lazada Live Affiliate Comment Engine. By following these procedures, you can ensure reliable testing, proper auditing, and effective emergency management of social media posts.

**Key Takeaways**:

1. **Always start with dry run tests** to validate the pipeline without posting
2. **Monitor Telegram audit notifications** for real-time status updates
3. **Use emergency controls** for immediate post deletion or audit override
4. **Review link health** before committing to social media posts
5. **Document all actions** for future reference and compliance

**Next Steps**:

1. Review all environment variables and credentials
2. Run a dry run test to validate the pipeline
3. Set up Telegram audit notifications
4. Train team members on emergency procedures
5. Establish regular monitoring and reporting schedules

---

_Document created by AI Assistant for @RacunDapurIbu Live Testing Phase 12_
_Last updated: 2026-08-02_
_For support, contact Chip Besar or consult the development team_
