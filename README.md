# WhatsApp Lead Qualifier Bot

![Node.js](https://img.shields.io/badge/Node.js-TypeScript-3178c6?style=for-the-badge)
![Twilio](https://img.shields.io/badge/Twilio-WhatsApp-f22f46?style=for-the-badge)
![Groq](https://img.shields.io/badge/Groq-AI%20Scoring-f59e0b?style=for-the-badge)
![Google Sheets](https://img.shields.io/badge/Google%20Sheets-Lead%20Storage-22a565?style=for-the-badge)

An automation bot that receives WhatsApp messages through Twilio, collects lead details, qualifies the lead with Groq AI, stores the result in Google Sheets, and notifies the business owner when a lead looks promising.

![WhatsApp Lead Qualifier Bot Flow](assets/whatsapp-bot-flow.svg)

## What It Does

- Receives incoming WhatsApp messages from Twilio.
- Guides the customer through a simple lead qualification conversation.
- Collects name, requirement, budget, timeline, and the original message.
- Uses Groq AI to clean the lead data and score it from 1 to 10.
- Saves qualified lead details to Google Sheets.
- Sends a WhatsApp alert to the owner when the lead score is high.

## Tech Stack

- **Express.js** - Webhook server for Twilio messages.
- **Trigger.dev** - Background task runner for lead processing.
- **Groq SDK** - AI-based lead cleanup and scoring.
- **Twilio** - WhatsApp messaging and owner alerts.
- **Google Sheets API** - Lead storage and lightweight CRM.
- **TypeScript** - Main project language.

## Project Structure

```text
.
├── src/
│   └── trigger/
│       └── whatsapp-lead-bot/
│           ├── conversation-state.ts
│           └── qualify-lead.ts
├── assets/
│   └── whatsapp-bot-flow.svg
├── server.ts
├── trigger.config.ts
├── test-message.ts
├── .env.example
├── readme.txt
├── package.json
└── README.md
```

## Basic Setup

The original plain-text setup guide is available in [`readme.txt`](readme.txt). This README is the presentable GitHub version of that same guide.

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a local `.env` file using the variable names from [`.env.example`](.env.example), then fill in your own credentials.

Required for AI scoring:

```env
GROQ_API_KEY=your_groq_api_key
```

Required for Trigger.dev:

```env
TRIGGER_PROJECT_ID=your_trigger_project_id
TRIGGER_SECRET_KEY=your_trigger_secret_key
```

Optional for Google Sheets logging:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_google_service_account_email
GOOGLE_PRIVATE_KEY="your_google_private_key_with_escaped_newlines"
GOOGLE_SHEET_ID=your_google_sheet_id
```

Optional for WhatsApp owner alerts:

```env
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=whatsapp:+14155238886
DEFAULT_OWNER_WHATSAPP_NUMBER=whatsapp:+1234567890
```

### 3. Start the Webhook Server

```bash
npx tsx server.ts
```

By default, the webhook server runs on:

```text
http://localhost:3000
```

### 4. Expose the Local Server

Use ngrok or a similar tunneling tool:

```bash
ngrok http 3000
```

Copy the generated HTTPS URL and add the webhook path:

```text
https://your-ngrok-url/webhook/twilio
```

Set that URL as your Twilio WhatsApp Sandbox webhook.

### 5. Start Trigger.dev

In another terminal:

```bash
npx trigger.dev@latest dev
```

### 6. Test the Bot

Send a WhatsApp message to your Twilio Sandbox number, for example:

```text
Hi, I need a website for my business. My budget is $5000 and I need it in 2 months.
```

The bot will collect missing details, qualify the lead, save it to Google Sheets if configured, and notify the owner when the score is high enough.

## Environment Safety

Real credentials should stay only in your local `.env` file. The repository includes `.gitignore` rules so `.env`, logs, local Trigger.dev files, and `node_modules` are not uploaded to GitHub.

## Notes

- Use `reset`, `restart`, or `start over` in WhatsApp to clear a conversation.
- If Google Sheets credentials are missing, the bot falls back to in-memory conversation state.
- If Twilio owner alert credentials are missing, lead qualification still runs, but owner notification is skipped.


