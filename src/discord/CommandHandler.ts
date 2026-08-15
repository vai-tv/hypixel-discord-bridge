import { Message } from "discord.js";
import { DiscordCommand } from "../contracts/Command.js";

import config from '../../config.json' with { type: "json" };

export class DiscordCommandHandler {
    private commands = new Map<string, DiscordCommand>();
    private prefix = config.bot.prefix;

    public registerCommand(command: DiscordCommand): void {
        this.commands.set(command.name.toLowerCase(), command);
    }

    public async handleMessage(message: Message): Promise<boolean> {
        if (!message.content.startsWith(this.prefix) || message.author.bot) return false;

        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName || !this.commands.has(commandName)) return false;

        const command = this.commands.get(commandName);

        try {
            await command.execute({
                author: message.author.displayName || message.author.username,
                args,
                channelId: message.channelId,
                reply: async (response) => {
                    await message.reply(response);
                }
            })
        } catch (error) {
            console.error(`[DiscordCommandHandler] Error executing command ${commandName}: ${error}`);
            await message.reply(`Error executing command ${commandName}: ${error}`);
        }

        return true;
    }
}