# Slack Integration Setup Guide

This guide walks you through setting up Slack notifications for your project management tool.

## Overview

The Slack integration uses the **Slack Bot API** to send direct messages to users. Users configure their Slack username in the app settings, and the bot will send them notifications based on their preferences.

## Prerequisites

- A Slack workspace where you have admin privileges
- Access to create Slack apps at https://api.slack.com/apps

## Step 1: Create a Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"**
3. Select **"From scratch"**
4. Enter app details:
   - **App Name**: `Project Management Tool` (or your preferred name)
   - **Workspace**: Select your workspace
5. Click **"Create App"**

## Step 2: Configure OAuth & Permissions

1. In your app settings, go to **"OAuth & Permissions"** from the left sidebar
2. Scroll down to **"Scopes"** section
3. Under **"Bot Token Scopes"**, add these scopes:
   - `chat:write` - Send messages as the bot
   - `users:read` - View people in the workspace (to find users by username)
4. Scroll to the top and click **"Install to Workspace"**
5. Review the permissions and click **"Allow"**
6. Copy the **"Bot User OAuth Token"** (starts with `xoxb-`)

## Step 3: Add Token to Environment Variables

1. Open your `.env` file
2. Set the `SLACK_BOT_TOKEN` variable:
   ```bash
   SLACK_BOT_TOKEN=xoxb-your-token-here
   ```
3. Remove or leave empty the `SLACK_SIGNING_SECRET` (not needed for bot DMs)

## Step 4: Verify Installation

### Test the bot connection:

```typescript
// Test file or API route
import { findSlackUser, testSlackBot } from '@/lib/slack';

// Find a user
const user = await findSlackUser('johndoe');
console.log('Found user:', user);

// Send test message
const result = await testSlackBot('johndoe');
console.log('Test result:', result);
```

## Step 5: User Configuration

Users can now configure Slack notifications in their settings:

1. Go to **Settings** → **Notifications**
2. Enable **Slack Notifications**
3. Enter their **Slack username** (without the @ symbol)
4. Choose which notification types to receive
5. Click **Save**

## How It Works

### Notification Flow

1. An event occurs (mention, assignment, comment, etc.)
2. System creates a notification in the database
3. Inngest function checks user's Slack preferences
4. If enabled and username is set:
   - Looks up Slack user ID using the username
   - Sends a formatted DM to the user
   - Updates notification record with `slackSentAt` timestamp

### Username Matching

The bot matches usernames against:
- Slack username (e.g., `johndoe`)
- Display name (e.g., `John Doe`)
- Real name (e.g., `John Doe`)

Matching is case-insensitive and strips the `@` prefix if provided.

## Troubleshooting

### "User not found" errors

- Ensure the user entered their exact Slack username or display name
- Check that the user is not a bot or deactivated account
- Verify the bot has `users:read` scope

### "Invalid or inactive Slack bot token" errors

- Regenerate the bot token in your Slack app settings
- Update the `SLACK_BOT_TOKEN` in your environment variables
- Restart your application

### Bot can't send messages

- Ensure the bot is installed in the workspace
- Verify the bot has `chat:write` scope
- Check that the workspace allows bots to send DMs

## Optional: Customize Bot Appearance

1. In your Slack app settings, go to **"Basic Information"**
2. Scroll to **"Display Information"**
3. Upload an app icon
4. Set a background color
5. Add a description
6. Click **"Save Changes"**

## Security Notes

- Store `SLACK_BOT_TOKEN` securely (never commit to version control)
- The token grants access to send messages to any user in the workspace
- Users can always block or mute the bot if they don't want notifications
- Consider rotating the token periodically for security

## Environment Variables Summary

Required:
```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
```

Not needed (legacy):
```bash
# SLACK_SIGNING_SECRET=  # Only needed for webhook signature verification
```
