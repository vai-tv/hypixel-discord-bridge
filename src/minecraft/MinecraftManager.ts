import mineflayer from 'mineflayer';
import path from 'path';
import type { Bot } from 'mineflayer';
import { Bridge } from '../bridge/Bridge.js';
import type { DiscordChatMessage } from '../bridge/Bridge.js';
import { ChatHandler } from './ChatHandler.js';

import config from '../../config.json' with { type: "json" };

import { setTimeout } from 'node:timers/promises';

export class MinecraftManager {
    public bot: Bot | null = null;
    private bridge: Bridge;
    private messageQueue: string[] = [];
    private isProcessingQueue = false;
    private readonly MESSAGE_DELAY_MS = 1200;
    private chatHandler: ChatHandler;

    constructor(bridge: Bridge) {
        this.bridge = bridge;
        this.chatHandler = new ChatHandler(bridge, () => this.bot?.username);
    }

    public send(message: string): void {
      const cleanMessage = message.replace(/[\r\n]+/g, ' ').trim();
      if (!cleanMessage) return;

      this.messageQueue.push(cleanMessage);
      this.processQueue();
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || !this.bot) return;

        this.isProcessingQueue = true;

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message && this.bot) {
                // Direct Mineflayer execution (prevents recursive queue loop)
                this.bot.chat(message);
                await setTimeout(this.MESSAGE_DELAY_MS);
            }
        }

        this.isProcessingQueue = false;
    }

    public connect(): void {
        this.bot = mineflayer.createBot({
            host: 'mc.hypixel.net',
            port: 25565,
            version: '1.8.9',
            auth: 'microsoft',
            username: config.bot.username,
            profilesFolder: path.join(process.cwd(), '.cache', 'mc-auth')
        });

        this.registerEvents();
    }

    private registerEvents(): void {
        if (!this.bot) return;

        this.bot.on('login', () => {
            console.log(`[MINECRAFT] ${this.bot?.username} joined Hypixel!`);
        });

        this.bot.on('kicked', (extra) => {
            console.warn(`[MINECRAFT Warning] Kicked: ${extra}`);
        });

        this.bot.on('end', async (extra) => {
            console.warn(`[MINECRAFT Warning] Disconnected: ${extra}`);
            const reconnect = config.bot.reconnect;

            if (reconnect) {
                let reconnectDelay = reconnect.delay;
                for (let i = 0; i < reconnect.max; i++) {
                    console.log(`[MINECRAFT] Reconnecting in ${(reconnectDelay / 1000).toFixed(1)}s... (${i + 1}/${reconnect.max})`);
                    await setTimeout(reconnectDelay);
                    this.connect();
                    reconnectDelay *= 1.3;
                }
            }
        });

        // Minecraft -> Discord
        this.bot.on('message', (jsonMessage) => {
            const message = jsonMessage.toString();
            this.chatHandler.handleChat(message);
        });

        // Discord -> Minecraft
        this.bridge.on('discordChat', (message: DiscordChatMessage) => {
            if (!this.bot) return;

            // ignore self-echoes if the message username matches the bot's username
            if (message.username.toLowerCase() === this.bot.username.toLowerCase()) return;

            if (message.channel === 'guild') {
                this.send(`/gc ${message.username}: ${message.message}`);
            } else if (message.channel === 'officer') {
                this.send(`/oc ${message.username}: ${message.message}`);
            } else if (message.channel === 'debug') {
                this.send(message.message);
            }

            this.bridge.emitDiscordChatAck(message.id);
        });
    }
}