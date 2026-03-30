# WhatsApp MCP + CLI

A WhatsApp integration that works in two ways:
- **MCP Server** — lets AI assistants like Claude control WhatsApp directly
- **CLI Tool** — send/read WhatsApp messages from your terminal

Built on [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).

---

## Features

- Send WhatsApp messages by contact name or phone number
- Read recent messages from any chat
- List all recent chats with previews
- Search contacts by name
- Works as an MCP server (Claude, etc.) or standalone CLI

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Authenticate WhatsApp

```bash
node index.js auth
```

Scan the QR code with your WhatsApp mobile app. Your session is saved locally — you only need to do this once.

---

## MCP Server (for Claude / AI assistants)

The MCP server exposes 4 tools over stdio:

| Tool | Description |
|------|-------------|
| `send_message` | Send a message to a contact |
| `read_messages` | Read recent messages from a chat |
| `list_chats` | List recent chats with previews |
| `search_contacts` | Search contacts by name |

### Configure in Claude Code

Add to your `.mcp.json` or Claude Code MCP settings:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["C:/path/to/whatsapp-cli/mcp-server.mjs"]
    }
  }
}
```

### Run manually

```bash
node mcp-server.mjs
```

---

## CLI Usage

### Send a message

```bash
node index.js send --to "John Doe" --message "Hey!"
# or by phone number
node index.js send --to 919876543210 --message "Hey!"
```

### Read messages

```bash
node index.js read --from "John Doe" --count 20
```

### List chats

```bash
node index.js list-chats --count 10
```

---

## Use Cases

- **AI-powered WhatsApp assistant** — plug into Claude or any MCP-compatible AI to read and send messages hands-free
- **WhatsApp automation** — build bots, auto-responders, or notification systems
- **Terminal messaging** — send/read WhatsApp messages without opening your phone
- **Business notifications** — send automated WhatsApp alerts from scripts or cron jobs

---

## Project Structure

```
├── index.js              # CLI entry point
├── mcp-server.mjs        # MCP server (for AI assistants)
├── src/
│   ├── client.js         # WhatsApp client setup
│   └── commands/
│       ├── auth.js       # QR code authentication
│       ├── send.js       # Send message command
│       ├── read.js       # Read messages command
│       └── list-chats.js # List chats command
└── package.json
```

---

## Requirements

- Node.js 18+
- A WhatsApp account (personal or business)

---

## License

MIT
