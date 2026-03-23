#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();

program
    .name('whatsapp-cli')
    .description('WhatsApp CLI tool - Send and receive WhatsApp messages from your terminal')
    .version('1.0.0');

// Auth command - Link your WhatsApp account
program
    .command('auth')
    .description('Authenticate with WhatsApp by scanning a QR code')
    .action(async () => {
        const authCommand = require('./src/commands/auth');
        await authCommand();
    });

// Send command - Send a message
program
    .command('send')
    .description('Send a WhatsApp message to a contact')
    .requiredOption('--to <contact>', 'Contact name or phone number (with country code, e.g., 919876543210)')
    .requiredOption('--message <text>', 'Message text to send')
    .action(async (options) => {
        const sendCommand = require('./src/commands/send');
        await sendCommand(options);
    });

// List chats command
program
    .command('list-chats')
    .description('List your recent WhatsApp chats')
    .option('--count <number>', 'Number of chats to display', '20')
    .action(async (options) => {
        const listChatsCommand = require('./src/commands/list-chats');
        await listChatsCommand(options);
    });

// Read command - Read messages from a chat
program
    .command('read')
    .description('Read messages from a specific chat')
    .requiredOption('--from <contact>', 'Contact name or phone number to read messages from')
    .option('--count <number>', 'Number of messages to fetch', '10')
    .action(async (options) => {
        const readCommand = require('./src/commands/read');
        await readCommand(options);
    });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
