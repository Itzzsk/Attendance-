const twilio = require("twilio");
require("dotenv").config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;

if (!accountSid || !authToken || !fromWhatsApp) {
  console.error("❌ Twilio environment variables missing. Please check your .env file.");
  process.exit(1);
}

const client = twilio(accountSid, authToken);

/**
 * Sends a WhatsApp message via Twilio.
 * @param {string} toNumber - Recipient phone number with country code, e.g. '917483729869'
 * @param {string} message - Message body text
 */
const sendWhatsAppMessage = async (toNumber, message) => {
  try {
    // Remove all non-digit characters (spaces, dashes, plus signs)
    const sanitizedNumber = toNumber.replace(/\D/g, "");

    if (sanitizedNumber.length < 10) {
      throw new Error("Phone number too short or invalid");
    }

    const fullTo = `whatsapp:+${sanitizedNumber}`;
    console.log(`Sending WhatsApp to: ${fullTo}`);

    const response = await client.messages.create({
      from: fromWhatsApp,
      to: fullTo,
      body: message,
    });

    console.log(`✅ WhatsApp sent to ${toNumber}, Message SID: ${response.sid}`);
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp to ${toNumber}:`, error.message || error);
  }
};

module.exports = sendWhatsAppMessage;
