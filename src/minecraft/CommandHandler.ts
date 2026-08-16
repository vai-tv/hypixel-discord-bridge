import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { MinecraftCommand } from "../contracts/Command.js";
import type { ChatChannel, Bridge } from "../bridge/Bridge.js";
import type { HypixelAPI } from '../api/HypixelAPI.js';
import config from '../../config.json' with { type: "json" };

type SendChatFunction = (message: string) => void;

export class MinecraftCommandHandler {
    private commands = new Map<string, MinecraftCommand>();
    private prefix = config.bot.prefix || '!';
    private sendChat: SendChatFunction;
    private hypixelApi: HypixelAPI;
    private bridge: Bridge;
    private botUsernameGetter: () => string | undefined;

    constructor(
        sendChat: SendChatFunction,
        hypixelApi: HypixelAPI,
        bridge: Bridge,
        getBotUsername: () => string | undefined
    ) {
        this.sendChat = sendChat;
        this.hypixelApi = hypixelApi;
        this.bridge = bridge;
        this.botUsernameGetter = getBotUsername;
    }

    public async loadCommands(): Promise<void> {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const commandsPath = path.join(__dirname, 'commands');

        if (!fs.existsSync(commandsPath)) {
            console.warn(`[MinecraftCommandHandler] Directory not found: ${commandsPath}`);
            return;
        } 

        const commandFiles = fs.readdirSync(commandsPath).filter(file => 
            (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
        );

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const fileUrl = pathToFileURL(filePath).href;

            try {
                const imported = await import(fileUrl);

                for (const ExportedSymbol of Object.values(imported)) {
                    if (
                        typeof ExportedSymbol === 'function' &&
                        ExportedSymbol.prototype instanceof MinecraftCommand
                    ) {
                        const commandInstance = new (ExportedSymbol as new (api: HypixelAPI) => MinecraftCommand)(this.hypixelApi);
                        this.registerCommand(commandInstance);
                        console.log(`[MinecraftCommandHandler] Loaded command ${commandInstance.name}`);
                    }
                }
            } catch (error) {
                console.error(`[MinecraftCommandHandler] Failed to load command file ${file}:`, error);
            }
        }
    }

    public registerCommand(command: MinecraftCommand) {
        this.commands.set(command.name.toLowerCase(), command);
        command.aliases.forEach((alias) => this.commands.set(alias.toLowerCase(), command));
    }

    public async handleMessage(username: string, message: string, channel: ChatChannel): Promise<boolean> {
        if (!message.startsWith(this.prefix)) return false;

        const args = message.slice(this.prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName || !this.commands.has(commandName)) return false;

        const command = this.commands.get(commandName)!;

        const reply = async (response: string) => {
            const cleanMsg = response.replace(/\r?\n|\r/g, ' ').slice(0, 250);

            // 1. Send to Hypixel chat queue
            if (channel === 'guild') {
                this.sendChat(`/gc ${cleanMsg}`);
            } else if (channel === 'officer') {
                this.sendChat(`/oc ${cleanMsg}`);
            } else if (channel === 'debug') {
                this.sendChat(cleanMsg);
            }

            // 2. Emit directly to Discord via Bridge
            this.bridge.emitMinecraftChat({
                username: this.botUsernameGetter() || 'Bot',
                message: cleanMsg,
                channel,
            });
        };

        try {
            await command.execute({
                username,
                args,
                channel,
                reply,
            });
        } catch (err) {
            console.error(`[MinecraftCommandHandler] Error running ${commandName}:`, err);
            await reply(`Error executing command: ${commandName}`);
        }

        return true;
    }
}