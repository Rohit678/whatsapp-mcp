import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Client, LocalAuth } = require("whatsapp-web.js");
const path = require("path");
const { fileURLToPath } = require("url");

// ── Globals ──────────────────────────────────────────────────────────────────
let waClient = null;
let waReady = false;

// ── WhatsApp Client Helpers ──────────────────────────────────────────────────

function createWAClient() {
    if (waClient) return waClient;

    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    waClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, ".wwebjs_auth"),
        }),
        puppeteer: {
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--disable-gpu",
            ],
        },
    });

    waClient.on("ready", () => {
        waReady = true;
        console.error("✅ WhatsApp client is ready");
    });

    waClient.on("auth_failure", (msg) => {
        console.error("❌ WhatsApp auth failed:", msg);
    });

    waClient.on("disconnected", (reason) => {
        console.error("🔌 WhatsApp disconnected:", reason);
        waReady = false;
    });

    waClient.on("qr", (qr) => {
        // Log to stderr so it doesn't interfere with MCP stdio protocol
        console.error("\n📱 QR CODE RECEIVED — Run `node index.js auth` to scan it first!\n");
        console.error("QR data:", qr);
    });

    return waClient;
}

async function getReadyWAClient() {
    const client = createWAClient();
    if (waReady) return client;

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("WhatsApp client timed out after 120s. Run `node index.js auth` first to scan the QR code."));
        }, 120000);

        client.on("ready", () => {
            clearTimeout(timeout);
            resolve(client);
        });

        client.on("auth_failure", (msg) => {
            clearTimeout(timeout);
            reject(new Error(`WhatsApp auth failed: ${msg}`));
        });

        client.initialize();
    });
}

async function findContact(client, query) {
    const contacts = await client.getContacts();
    const q = query.toLowerCase().trim();
    const digits = query.replace(/\D/g, "");

    // Phone number match
    if (digits.length >= 7) {
        const match = contacts.find((c) => {
            const cd = (c.number || "").replace(/\D/g, "");
            return cd.endsWith(digits) || digits.endsWith(cd);
        });
        if (match) return match;
    }

    // Exact name match
    const exact = contacts.find(
        (c) =>
            (c.name && c.name.toLowerCase() === q) ||
            (c.pushname && c.pushname.toLowerCase() === q)
    );
    if (exact) return exact;

    // Partial name match
    const partials = contacts.filter(
        (c) =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.pushname && c.pushname.toLowerCase().includes(q))
    );
    if (partials.length === 1) return partials[0];
    if (partials.length > 1) {
        const list = partials
            .slice(0, 10)
            .map((c) => `  - ${c.name || c.pushname || "Unknown"} (${c.number || c.id._serialized})`)
            .join("\n");
        throw new Error(`Multiple contacts match "${query}":\n${list}\nPlease be more specific.`);
    }

    throw new Error(`No contact found for "${query}". Use phone number with country code (e.g. 919876543210).`);
}

// ── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
    name: "whatsapp",
    version: "1.0.0",
});

// ── Tool: send_message ───────────────────────────────────────────────────────
server.registerTool(
    "send_message",
    {
        description:
            "Send a WhatsApp message to a contact by name or phone number. Phone numbers must include country code without + (e.g. 919876543210).",
        inputSchema: {
            to: z.string().describe("Contact name or phone number with country code (e.g. 919876543210)"),
            message: z.string().describe("The message text to send"),
        },
    },
    async ({ to, message }) => {
        try {
            const client = await getReadyWAClient();
            const isPhone = /^\+?\d[\d\s-]{6,}$/.test(to.trim());
            let chatId;

            if (isPhone) {
                const digits = to.replace(/\D/g, "");
                chatId = `${digits}@c.us`;
                const registered = await client.isRegisteredUser(chatId);
                if (!registered) {
                    return { content: [{ type: "text", text: `❌ ${to} is not on WhatsApp.` }] };
                }
            } else {
                const contact = await findContact(client, to);
                chatId = contact.id._serialized;
            }

            const sent = await client.sendMessage(chatId, message);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            to,
                            chatId,
                            message,
                            messageId: sent.id._serialized,
                            timestamp: new Date().toISOString(),
                        }, null, 2),
                    },
                ],
            };
        } catch (err) {
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
    }
);

// ── Tool: read_messages ──────────────────────────────────────────────────────
server.registerTool(
    "read_messages",
    {
        description:
            "Read recent messages from a WhatsApp chat by contact name or phone number.",
        inputSchema: {
            from: z.string().describe("Contact name or phone number to read messages from"),
            count: z.number().optional().default(10).describe("Number of messages to fetch (default 10)"),
        },
    },
    async ({ from, count }) => {
        try {
            const client = await getReadyWAClient();
            const isPhone = /^\+?\d[\d\s-]{6,}$/.test(from.trim());
            let chat;

            if (isPhone) {
                const digits = from.replace(/\D/g, "");
                chat = await client.getChatById(`${digits}@c.us`);
            } else {
                const contact = await findContact(client, from);
                chat = await contact.getChat();
            }

            const messages = await chat.fetchMessages({ limit: count || 10 });
            const formatted = messages.map((msg) => ({
                fromMe: msg.fromMe,
                sender: msg.fromMe ? "You" : (chat.name || from),
                body: msg.body || (msg.hasMedia ? "[Media]" : "[Empty]"),
                timestamp: new Date(msg.timestamp * 1000).toISOString(),
                hasMedia: msg.hasMedia,
            }));

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ chat: chat.name || from, messages: formatted }, null, 2),
                    },
                ],
            };
        } catch (err) {
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
    }
);

// ── Tool: list_chats ─────────────────────────────────────────────────────────
server.registerTool(
    "list_chats",
    {
        description: "List recent WhatsApp chats with last message preview.",
        inputSchema: {
            count: z.number().optional().default(20).describe("Number of chats to return (default 20)"),
        },
    },
    async ({ count }) => {
        try {
            const client = await getReadyWAClient();
            const chats = await client.getChats();
            const recent = chats.slice(0, count || 20);

            const result = recent.map((chat) => ({
                name: chat.name || "Unknown",
                isGroup: chat.isGroup,
                unreadCount: chat.unreadCount,
                lastMessage: chat.lastMessage ? chat.lastMessage.body : null,
                timestamp: chat.lastMessage
                    ? new Date(chat.lastMessage.timestamp * 1000).toISOString()
                    : null,
            }));

            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        } catch (err) {
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
    }
);

// ── Tool: search_contacts ────────────────────────────────────────────────────
server.registerTool(
    "search_contacts",
    {
        description: "Search your WhatsApp contacts by name.",
        inputSchema: {
            query: z.string().describe("Name to search for"),
        },
    },
    async ({ query }) => {
        try {
            const client = await getReadyWAClient();
            const contacts = await client.getContacts();
            const q = query.toLowerCase();

            const matches = contacts.filter(
                (c) =>
                    (c.name && c.name.toLowerCase().includes(q)) ||
                    (c.pushname && c.pushname.toLowerCase().includes(q))
            );

            const result = matches.slice(0, 20).map((c) => ({
                name: c.name || c.pushname || "Unknown",
                pushname: c.pushname || null,
                number: c.number || null,
                isGroup: c.isGroup,
            }));

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ query, matches: result.length, contacts: result }, null, 2),
                    },
                ],
            };
        } catch (err) {
            return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
        }
    }
);

// ── Start Server ─────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🟢 WhatsApp MCP Server running on stdio");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
