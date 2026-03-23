const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

let clientInstance = null;
let isReady = false;

/**
 * Create and initialize the WhatsApp client.
 * Uses LocalAuth to persist session so you only scan QR once.
 */
function createClient() {
    if (clientInstance) return clientInstance;

    clientInstance = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, '..', '.wwebjs_auth')
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu'
            ]
        }
    });

    clientInstance.on('qr', (qr) => {
        console.log('\n📱 Scan this QR code with your WhatsApp app:\n');
        qrcode.generate(qr, { small: true });
        console.log('Open WhatsApp → Settings → Linked Devices → Link a Device\n');
    });

    clientInstance.on('ready', () => {
        isReady = true;
    });

    clientInstance.on('auth_failure', (msg) => {
        console.error('❌ Authentication failed:', msg);
        process.exit(1);
    });

    clientInstance.on('disconnected', (reason) => {
        console.log('🔌 Client disconnected:', reason);
        isReady = false;
    });

    return clientInstance;
}

/**
 * Initialize client and wait until it's ready.
 * Returns a promise that resolves when the client is authenticated and ready.
 */
async function getReadyClient() {
    const client = createClient();

    if (isReady) return client;

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Client initialization timed out after 120 seconds. Make sure you scanned the QR code.'));
        }, 120000);

        client.on('ready', () => {
            clearTimeout(timeout);
            resolve(client);
        });

        client.on('auth_failure', (msg) => {
            clearTimeout(timeout);
            reject(new Error(`Authentication failed: ${msg}`));
        });

        client.initialize();
    });
}

/**
 * Find a contact by name or phone number.
 * Supports fuzzy matching on contact name.
 */
async function findContact(client, query) {
    const contacts = await client.getContacts();
    const queryLower = query.toLowerCase().trim();

    // Try exact phone number match first (strip non-digits)
    const queryDigits = query.replace(/\D/g, '');
    if (queryDigits.length >= 7) {
        const phoneMatch = contacts.find(c => {
            const contactDigits = (c.number || '').replace(/\D/g, '');
            return contactDigits.endsWith(queryDigits) || queryDigits.endsWith(contactDigits);
        });
        if (phoneMatch) return phoneMatch;
    }

    // Try exact name match
    const exactMatch = contacts.find(c =>
        c.name && c.name.toLowerCase() === queryLower ||
        c.pushname && c.pushname.toLowerCase() === queryLower
    );
    if (exactMatch) return exactMatch;

    // Try partial name match
    const partialMatches = contacts.filter(c =>
        (c.name && c.name.toLowerCase().includes(queryLower)) ||
        (c.pushname && c.pushname.toLowerCase().includes(queryLower))
    );

    if (partialMatches.length === 1) return partialMatches[0];

    if (partialMatches.length > 1) {
        const matchList = partialMatches.slice(0, 10).map(c =>
            `  - ${c.name || c.pushname || 'Unknown'} (${c.number || c.id._serialized})`
        ).join('\n');
        throw new Error(`Multiple contacts match "${query}":\n${matchList}\nPlease be more specific.`);
    }

    throw new Error(`No contact found matching "${query}". Use a phone number with country code (e.g., 919876543210) or an exact name.`);
}

module.exports = { createClient, getReadyClient, findContact };
