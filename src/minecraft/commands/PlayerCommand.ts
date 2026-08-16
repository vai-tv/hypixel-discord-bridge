import { MinecraftCommand } from "../../contracts/Command.js";
import type { MinecraftCommandContext } from "../../contracts/Command.js";
import { HypixelAPI } from "../../api/HypixelAPI.js";

export class PlayerCommand extends MinecraftCommand {
    private hypixelApi: HypixelAPI;

    public name = 'player';
    public description = 'Get player overall stats';
    public aliases = ['me', 'p'];

    constructor(hypixelApi: HypixelAPI) {
        super();
        this.hypixelApi = hypixelApi;
    }

    public async execute(context: MinecraftCommandContext): Promise<void> {
        const target = context.args[0] || context.username;

        try {
            const { player, guild } = await this.hypixelApi.getPlayer(target) || {};

            if (!player) {
                await context.reply(`Player '${target}' not found or API request failed.`);
                return;
            }

            const { level, rank, nickname, karma } = player;

            await context.reply(`(${level}) ${rank} ${nickname} :  member of ${guild} | ${karma.toLocaleString()} Karma`);

        } catch (err: any) {
            console.error(`[MINECRAFT Command] Error:`, err);
            await context.reply(`[ERROR]: ${err}`);
        }
    }
}