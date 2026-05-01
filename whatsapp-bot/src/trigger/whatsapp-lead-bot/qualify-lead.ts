import { task } from "@trigger.dev/sdk/v3";
import Groq from "groq-sdk";
import { google } from "googleapis";
import twilio from "twilio";

type LeadPayload = {
  from: string;
  lead: {
    name?: string;
    requirement?: string;
    budget?: string;
    timeline?: string;
    initialMessage?: string;
  };
};

export async function processLeadQualification(payload: LeadPayload) {
  console.log("Received new lead payload:", payload);

  const { from, lead } = payload;
  
  // 1. Analyze with Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY is not set");
  const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const groq = new Groq({ apiKey: groqKey });
  
  console.log("Analyzing message with Groq...");
  const response = await groq.chat.completions.create({
    model: groqModel,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a lead qualifier bot. Review the structured lead details, clean them up for CRM use, and score this lead from 1-10 based on how complete and serious the inquiry seems. Output strictly as JSON with keys: name, requirement, budget, timeline, score, reasoning."
      },
      {
        role: "user",
        content: `Here is the collected lead data:\n\n${JSON.stringify(lead, null, 2)}`
      }
    ]
  });

  const llmOutput = response.choices[0]?.message?.content || "{}";
  console.log("Groq output:", llmOutput);

  let extractedData;
  try {
    extractedData = JSON.parse(llmOutput);
  } catch (e) {
    console.warn("Could not parse Groq output cleanly. Saving raw output.");
    extractedData = { raw: llmOutput };
  }

  const leadScore = Number(extractedData.score || 0);

  // 2. Google Sheets
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (serviceAccountEmail && privateKey && sheetId) {
      console.log("Logging to Google Sheets...");
      const transformedKey = privateKey.replace(/\\n/g, '\n');
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: transformedKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
      });

      const sheets = google.sheets({ version: "v4", auth });
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A:G", // Adjust based on your sheet
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              from,
              extractedData.name || lead.name || "Unknown",
              extractedData.requirement || lead.requirement || "Unknown",
              extractedData.budget || lead.budget || "Unknown",
              extractedData.timeline || lead.timeline || "Unknown",
              leadScore || "Unscored",
              new Date().toISOString()
            ]
          ]
        }
      });
      console.log("Row added to Google Sheets.");
  } else {
      console.log("Skipping Google Sheets logging as credentials are not set.");
  }

  // 3. Notify Owner via Twilio
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_FROM_NUMBER; // Usually 'whatsapp:+14155238886' for sandbox
  const ownerNumber = process.env.DEFAULT_OWNER_WHATSAPP_NUMBER;

  if (twilioAccountSid && twilioAuthToken && twilioFromNumber && ownerNumber && leadScore >= 7) {
      console.log("Notifying owner via Twilio for high-quality lead...");
      const client = twilio(twilioAccountSid, twilioAuthToken);
      await client.messages.create({
          body: `*New Qualified Lead (Score ${leadScore}/10)*\n\nName: ${extractedData.name || lead.name}\nReq: ${extractedData.requirement || lead.requirement}\nBudget: ${extractedData.budget || lead.budget}\nTimeline: ${extractedData.timeline || lead.timeline}\nFrom: ${from}`,
          from: twilioFromNumber,
          to: ownerNumber
      });
      console.log("Owner notified.");
  } else {
      console.log("Skipping owner notification either due to missing Twilio credentials or score < 7.");
  }

  return { success: true, extractedData };
}

export const qualifyLeadTask = task({
  id: "qualify-lead",
  maxDuration: 60 * 5, // 5 minutes max
  run: async (payload: LeadPayload) => {
    return processLeadQualification(payload);
  },
});
