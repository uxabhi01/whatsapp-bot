import twilio from "twilio";
import dotenv from "dotenv";
import path from "path";

// Load .env from workspace root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function sendTest() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  let fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  let toNumber = process.env.DEFAULT_OWNER_WHATSAPP_NUMBER?.trim();

  // Attempting to send as Standard SMS since the 2254 number is not WhatsApp enrolled!
  if (fromNumber && fromNumber.startsWith('whatsapp:')) fromNumber = fromNumber.replace('whatsapp:', '');
  if (toNumber && toNumber.startsWith('whatsapp:')) toNumber = toNumber.replace('whatsapp:', '');

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    console.error("Missing Twilio credentials in .env");
    console.log({ accountSid: !!accountSid, authToken: !!authToken, fromNumber: !!fromNumber, toNumber: !!toNumber });
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);

  console.log(`[DEBUG] From Number starts with 'whatsapp:': ${fromNumber.startsWith('whatsapp:')}`);
  console.log(`[DEBUG] From Number ends in: ...${fromNumber.slice(-4)}`);
  console.log(`[DEBUG] To Number ends in: ...${toNumber.slice(-4)}`);
  console.log(`[DEBUG] Twilio Account SID ends in: ...${accountSid.slice(-4)}`);

  try {
    console.log("Attempting to send message via Twilio SDK...");
    const message = await client.messages.create({
      body: "Test message from the WhatsApp lead qualifier bot.",
      from: fromNumber,
      to: toNumber,
    });
    console.log(`Success! Message sent to ${toNumber}. SID: ${message.sid}`);
  } catch (error) {
    console.error("Failed to send message:", error);
    process.exit(1);
  }
}

sendTest();
