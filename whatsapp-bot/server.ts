import express from "express";
import dotenv from "dotenv";
import {
  advanceConversation,
  clearConversationState,
} from "./src/trigger/whatsapp-lead-bot/conversation-state.js";
import { processLeadQualification } from "./src/trigger/whatsapp-lead-bot/qualify-lead.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Twilio sends data as URL encoded
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/webhook/twilio", async (req, res) => {
  try {
    const { From, Body } = req.body;
    console.log(`Received WhatsApp message full payload:`, req.body);

    if (From && Body) {
      const incomingText = String(Body).trim();

      if (/^(reset|start over|restart)$/i.test(incomingText)) {
        await clearConversationState(From);
        res.set("Content-Type", "text/xml");
        res.send("<Response><Message>Your conversation was reset. Tell me what you need help with and I'll start fresh.</Message></Response>");
        return;
      }

      const result = await advanceConversation(From, incomingText);
      const leadPayload = result.completed
        ? {
            from: From,
            lead: buildLeadPayload(result.state),
          }
        : null;

      res.set("Content-Type", "text/xml");
      res.send(`<Response><Message>${escapeXml(result.reply)}</Message></Response>`);

      if (leadPayload) {
        void processLeadQualification(leadPayload)
          .then(() => clearConversationState(From))
          .then(() => {
            console.log(`Finished local lead qualification for ${From}.`);
          })
          .catch((error) => {
            console.error("Background lead qualification failed:", error);
          });
      }

      return;
    } else {
      console.log("Missing From or Body in the webhook payload");
    }

    res.set("Content-Type", "text/xml");
    res.send("<Response></Response>");
  } catch (error) {
    console.error("Error triggering task:", error);
    res.status(500).send("Internal Server Error");
  }
});

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildLeadPayload(state: {
  name?: string;
  requirement?: string;
  budget?: string;
  timeline?: string;
  initialMessage?: string;
}) {
  const lead: {
    name?: string;
    requirement?: string;
    budget?: string;
    timeline?: string;
    initialMessage?: string;
  } = {};

  if (state.name) lead.name = state.name;
  if (state.requirement) lead.requirement = state.requirement;
  if (state.budget) lead.budget = state.budget;
  if (state.timeline) lead.timeline = state.timeline;
  if (state.initialMessage) lead.initialMessage = state.initialMessage;

  return lead;
}

app.listen(port, () => {
  console.log(`Webhook server is running on port ${port}`);
  console.log(`Expose this port using ngrok (e.g. ngrok http ${port}) and set it as your Twilio Sandbox Webhook URL.`);
});
