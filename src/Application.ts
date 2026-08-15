import 'dotenv/config'
import { Bridge } from './bridge/Bridge.js';
import { MinecraftManager } from './minecraft/MinecraftManager.js';
import { DiscordManager } from './discord/DiscordManager.js';

class Application {
    private bridge: Bridge;
    private minecraftManager: MinecraftManager;
    private discordManager: DiscordManager;

    constructor() {
        this.bridge = new Bridge();
        this.minecraftManager = new MinecraftManager(this.bridge);
        this.discordManager = new DiscordManager(this.bridge);
    }

    public async start(): Promise<void> {
        console.log('[APP] Starting the bridge...')
        this.minecraftManager.connect();
        await this.discordManager.connect();
    }
}

const app = new Application();
app.start();