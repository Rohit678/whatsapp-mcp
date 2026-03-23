const { getReadyClient, findContact } = require('../client');

/**
 * Read messages from a specific WhatsApp chat.
 * @param {object} options - { from: string, count: number }
 */
async function readCommand(options) {
    const { from, count: countStr } = options;
    const count = parseInt(countStr) || 10;

    if (!from) {
        console.error('❌ --from is required.');
        console.error('Usage: node index.js read --from "Contact Name" --count 10');
        process.exit(1);
    }

    try {
        console.log('📡 Connecting to WhatsApp...');
        const client = await getReadyClient();
        console.log('✅ Connected!\n');

        // Find the contact
        const isPhoneNumber = /^\+?\d[\d\s-]{6,}$/.test(from.trim());
        let chat;

        if (isPhoneNumber) {
            const digits = from.replace(/\D/g, '');
            const chatId = `${digits}@c.us`;
            chat = await client.getChatById(chatId);
        } else {
            console.log(`🔍 Searching for contact "${from}"...`);
            const contact = await findContact(client, from);
            chat = await contact.getChat();
            console.log(`📇 Found: ${contact.name || contact.pushname || contact.number}\n`);
        }

        // Fetch messages
        const messages = await chat.fetchMessages({ limit: count });

        console.log(`💬 Messages from ${chat.name || from} (${messages.length} messages):\n`);
        console.log('─'.repeat(70));

        const messageList = [];

        for (const msg of messages) {
            const sender = msg.fromMe ? '📤 You' : `📥 ${chat.name || from}`;
            const time = new Date(msg.timestamp * 1000).toLocaleString();
            const body = msg.body || (msg.hasMedia ? '[Media]' : '[Empty]');

            console.log(`${sender} (${time}):`);
            console.log(`  ${body}`);
            console.log('─'.repeat(70));

            messageList.push({
                fromMe: msg.fromMe,
                sender: msg.fromMe ? 'You' : (chat.name || from),
                body: body,
                timestamp: time,
                hasMedia: msg.hasMedia,
                messageId: msg.id._serialized
            });
        }

        // Output JSON for programmatic access
        console.log('\n📊 JSON Output:');
        console.log(JSON.stringify(messageList, null, 2));

        await client.destroy();
        process.exit(0);
    } catch (error) {
        console.error(`❌ Failed to read messages: ${error.message}`);
        process.exit(1);
    }
}

module.exports = readCommand;
