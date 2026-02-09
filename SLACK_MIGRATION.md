# Slack Bot API Migration Summary

## What Changed

The Slack integration has been updated from **Webhook-based** to **Bot API-based** notifications.

### Before (Webhooks)
- Users configured individual webhook URLs for each channel
- Each webhook sent to a specific channel
- Required per-channel setup

### After (Bot API)
- One workspace-level bot installation
- Users enter their Slack username
- Bot sends direct messages to users

## Files Modified

### 1. Schema & Types
- [src/lib/db/schema/users.ts](src/lib/db/schema/users.ts)
  - Already had `slackUsername` field (no changes needed)

### 2. Slack Client
- [src/lib/slack/client.ts](src/lib/slack/client.ts)
  - Added `findSlackUser()` - finds user ID by username
  - Added `sendSlackDirectMessage()` - sends DM via Bot API
  - Added `sendSlackMessageToUser()` - combines lookup + send
  - Added `testSlackBot()` - test bot connection
  - Kept legacy webhook functions as deprecated

### 3. Slack Exports
- [src/lib/slack/index.ts](src/lib/slack/index.ts)
  - Exported new Bot API functions

### 4. Notification Functions
- [src/lib/inngest/functions/send-slack-notification.ts](src/lib/inngest/functions/send-slack-notification.ts)
  - Updated to use `slackUsername` instead of `webhookUrl`
  - Uses `sendSlackMessageToUser()` instead of `sendSlackMessage()`
  - Updated error handling for Bot API errors

- [src/lib/inngest/functions/send-comment-slack-notification.ts](src/lib/inngest/functions/send-comment-slack-notification.ts) **NEW**
  - Handles Slack notifications for comment events
  - Mirrors the email notification pattern

### 5. UI Components
- [src/components/settings/NotificationSettingsMatrix.tsx](src/components/settings/NotificationSettingsMatrix.tsx)
  - Updated to use `slackUsername` instead of `webhookUrl`

- [src/components/settings/SlackSettings.tsx](src/components/settings/SlackSettings.tsx)
  - Already configured for `slackUsername` (no changes needed)

### 6. Documentation
- [docs/SLACK_SETUP.md](docs/SLACK_SETUP.md) **NEW**
  - Complete setup guide
  - OAuth scope requirements
  - Troubleshooting tips

### 7. Environment Variables
- [.env](.env)
  - Simplified to only require `SLACK_BOT_TOKEN`
  - Removed `SLACK_SIGNING_SECRET` (not needed for Bot DMs)

## Setup Required

### 1. Create Slack App
1. Go to https://api.slack.com/apps
2. Create new app "From scratch"
3. Add scopes: `chat:write`, `users:read`
4. Install to workspace
5. Copy Bot User OAuth Token

### 2. Add Token to .env
```bash
SLACK_BOT_TOKEN=xoxb-your-token-here
```

### 3. Users Configure Username
Users go to Settings → Notifications → Slack and enter their Slack username.

## How It Works

1. **User Configuration**
   - User enables Slack notifications
   - Enters Slack username (e.g., "johndoe")
   - Selects which notification types to receive

2. **Notification Flow**
   - Event triggers (mention, assignment, comment, etc.)
   - Inngest function checks user preferences
   - If Slack enabled & username set:
     - Looks up Slack user ID using `findSlackUser(username)`
     - Sends DM using `sendSlackDirectMessage(userId, message)`
     - Updates notification with `slackSentAt` timestamp

3. **Username Matching**
   - Matches against Slack username, display name, or real name
   - Case-insensitive
   - Strips @ prefix automatically

## Migration Notes

- ✅ Schema already supported `slackUsername`
- ✅ UI already configured for username input
- ✅ All legacy webhook code kept as deprecated (won't break existing code)
- ✅ New Bot API functions added alongside webhooks
- ⚠️ Existing users with webhooks configured will need to:
  1. Switch to username instead
  2. Or keep webhooks (still supported via legacy functions)

## Testing

### Test Bot Connection
```typescript
import { testSlackBot } from '@/lib/slack';

const result = await testSlackBot('johndoe');
console.log(result); // { success: true } or { success: false, error: '...' }
```

### Test User Lookup
```typescript
import { findSlackUser } from '@/lib/slack';

const user = await findSlackUser('johndoe');
console.log(user); // { id: 'U12345', name: 'johndoe', real_name: 'John Doe' }
```

## Benefits

- ✅ Simpler user setup (just username vs full webhook URL)
- ✅ Direct messages instead of channel posts
- ✅ One bot for entire workspace
- ✅ Better error handling and user feedback
- ✅ More secure (token stored server-side)
