const { getReadyClient, findContact } = require('../client');

/**
 * Send a WhatsApp message to a contact.
 * @param {object} options - { to: string, message: string }
 */
async function sendCommand(options) {
    const { to, message } = options;

    if (!to || !message) {
        console.error('❌ Both --to and --message are required.');
        console.error('Usage: node index.js send --to "Contact Name" --message "Your message"');
        process.exit(1);
    }

    try {
        console.log('📡 Connecting to WhatsApp...');
        const client = await getReadyClient();
        console.log('✅ Connected!\n');

        // Check if 'to' looks like a phone number
        const isPhoneNumber = /^\+?\d[\d\s-]{6,}$/.test(to.trim());
        let chatId;

        if (isPhoneNumber) {
            // Format phone number for WhatsApp: strip non-digits, add @c.us
            const digits = to.replace(/\D/g, '');
            chatId = `${digits}@c.us`;

            // Verify the number exists on WhatsApp
            const isRegistered = await client.isRegisteredUser(chatId);
            if (!isRegistered) {
                console.error(`❌ Phone number ${to} is not registered on WhatsApp.`);
                await client.destroy();
                process.exit(1);
            }
        } else {
            // Search by contact name
            console.log(`🔍 Searching for contact "${to}"...`);
            const contact = await findContact(client, to);
            chatId = contact.id._serialized;
            console.log(`📇 Found: ${contact.name || contact.pushname || contact.number}\n`);
        }

        // Send the message
        console.log(`💬 Sending message to ${to}...`);
        const sentMsg = await client.sendMessage(chatId, message);

        // Output result as JSON for easy parsing by AI tools
        const result = {
            success: true,
            to: to,
            chatId: chatId,
            message: message,
            messageId: sentMsg.id._serialized,
            timestamp: new Date().toISOString()
        };

        console.log('\n✅ Message sent successfully!');
        console.log(JSON.stringify(result, null, 2));

        await client.destroy();
        process.exit(0);
    } catch (error) {
        console.error(`❌ Failed to send message: ${error.message}`);
        process.exit(1);
    }
}

module.exports = sendCommand;
