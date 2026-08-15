import { MinecraftCommand } from "../../contracts/Command.js";
import type { MinecraftCommandContext } from "../../contracts/Command.js";
import { HypixelAPI } from "../../api/HypixelAPI.js";

export class StatsCommand extends MinecraftCommand {
    public name = 'player';
    public description = 'Get player overall stats';
    public aliases = ['me', 'p'];

    private hypixelApi: HypixelAPI;

    constructor(hypixelApi: HypixelAPI) {
        super();
        this.hypixelApi = new HypixelAPI();
    }

    public async execute(context: MinecraftCommandContext): Promise<void> {
        const target = context.args[0] || context.username;
        const player = await this.hypixelApi.getPlayer(target);

        await context.reply('Unimplemented!');
    }
}