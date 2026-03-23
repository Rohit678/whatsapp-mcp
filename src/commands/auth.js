const { createClient } = require('../client');

/**
 * Auth command: Initialize client, display QR, wait for authentication.
 * Run this once to link your WhatsApp account.
 */
async function authCommand() {
    console.log('🔐 Starting WhatsApp authentication...\n');

    const client = createClient();

    client.on('ready', () => {
        console.log('\n✅ WhatsApp client authenticated and ready!');
        console.log('📁 Session saved. You won\'t need to scan again unless you log out.\n');
        console.log('You can now use other commands like:');
        console.log('  node index.js list-chats');
        console.log('  node index.js send --to "Name" --message "Hello"');
        console.log('  node index.js read --from "Name"');
        console.log('\nPress Ctrl+C to exit.');
    });

    client.on('authenticated', () => {
        console.log('🔑 Authenticated successfully! Waiting for client to be ready...');
    });

    try {
        await client.initialize();
    } catch (error) {
        console.error('❌ Failed to initialize client:', error.message);
        process.exit(1);
    }
}

module.exports = authCommand;
