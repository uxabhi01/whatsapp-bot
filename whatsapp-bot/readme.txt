WhatsApp Lead Qualifier Bot

This project is a WhatsApp lead automation bot. It listens for incoming WhatsApp messages via Twilio, processes the text to extract lead details (Name, Requirement, Budget, Timeline) using the Groq Llama-3 model, saves the extracted details to a Google Sheet, and automatically alerts the business owner if the lead is highly qualified (score >= 7). It is built using Express.js, Trigger.dev, Groq, Twilio, and Google Sheets APIs.

=============================
       SETUP GUIDE
=============================

1. Install Dependencies
Make sure you have Node.js installed, then run:
   npm install

2. Environment Variables
Create a `.env` file in the root directory and configure the following variables:

# Groq (Required for Lead Scoring)
GROQ_API_KEY=your_groq_api_key

# Google Sheets (Optional, for logging leads)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_google_service_account_email
GOOGLE_PRIVATE_KEY="your_google_private_key_with_\n_newlines"
GOOGLE_SHEET_ID=your_google_sheet_id

# Twilio (Optional, for sending alerts to the owner)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=whatsapp:+14155238886
DEFAULT_OWNER_WHATSAPP_NUMBER=whatsapp:+1234567890

3. Twilio Configuration
- Go to your Twilio Console -> Messaging -> Try it out -> Send a WhatsApp message.
- Join the sandbox using your device.
- We will need to set the Sandbox Webhook URL in the Usage step.

=============================
       USAGE GUIDE
=============================

1. Start the Webhook Server
Run the Express server to listen for Twilio webhooks. Since the project uses TypeScript, you can start it with tsx or ts-node:
   npx tsx server.ts

By default, the server will run on port 3000.

2. Expose the Server to the Internet
Since Twilio needs a public URL to send webhooks, expose your local port using ngrok (or a similar tool):
   ngrok http 3000

Copy the HTTPS forwarding URL provided by ngrok.

3. Update Twilio Webhook URL
In your Twilio Sandbox settings, paste the ngrok URL followed by the webhook path:
   https://<your-ngrok-url>/webhook/twilio

4. Start Trigger.dev
In a new terminal window, start the Trigger.dev development server to process tasks locally:
   npx trigger.dev@latest dev

5. Test the Automation
Send a message from your WhatsApp app to your Twilio Sandbox number, such as:
"Hi, my name is John. I'm looking for a new website. My budget is $5000 and I need it in 2 months."

The pipeline will execute:
- Twilio forwards the message to your Webhook server.
- The server triggers the 'qualify-lead' task on Trigger.dev.
- Groq extracts lead information and scores it out of 10.
- The result is appended to your Google Sheet.
- If the score is 7 or above, Twilio will send a notification WhatsApp message to the DEFAULT_OWNER_WHATSAPP_NUMBER.
