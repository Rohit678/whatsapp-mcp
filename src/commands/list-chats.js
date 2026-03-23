const { getReadyClient } = require('../client');

/**
 * List recent WhatsApp chats.
 * @param {object} options - { count: number }
 */
async function listChatsCommand(options) {
    const count = parseInt(options.count) || 20;

    try {
        console.log('📡 Connecting to WhatsApp...');
        const client = await getReadyClient();
        console.log('✅ Connected!\n');

        const chats = await client.getChats();
        const recentChats = chats.slice(0, count);

        console.log(`📋 Recent Chats (showing ${recentChats.length} of ${chats.length}):\n`);
        console.log('─'.repeat(70));

        const chatList = [];

        for (const chat of recentChats) {
            const name = chat.name || 'Unknown';
            const isGroup = chat.isGroup ? '👥' : '👤';
            const unread = chat.unreadCount > 0 ? ` (${chat.unreadCount} unread)` : '';
            const lastMsg = chat.lastMessage
                ? chat.lastMessage.body.substring(0, 50) + (chat.lastMessage.body.length > 50 ? '...' : '')
                : 'No messages';
            const timestamp = chat.lastMessage
                ? new Date(chat.lastMessage.timestamp * 1000).toLocaleString()
                : '';

            console.log(`${isGroup} ${name}${unread}`);
            console.log(`   Last: ${lastMsg}`);
            if (timestamp) console.log(`   Time: ${timestamp}`);
            console.log('─'.repeat(70));

            chatList.push({
                name,
                isGroup: chat.isGroup,
                unreadCount: chat.unreadCount,
                lastMessage: chat.lastMessage ? chat.lastMessage.body : null,
                timestamp: timestamp || null,
                chatId: chat.id._serialized
            });
        }

        // Output JSON at the end for programmatic access
        console.log('\n📊 JSON Output:');
        console.log(JSON.stringify(chatList, null, 2));

        await client.destroy();
        process.exit(0);
    } catch (error) {
        console.error(`❌ Failed to list chats: ${error.message}`);
        process.exit(1);
    }
}

module.exports = listChatsCommand;
