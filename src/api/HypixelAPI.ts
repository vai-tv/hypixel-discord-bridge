import { Client, Player } from 'hypixel-api-reborn';

export class HypixelAPI {
    private hypixel: Client;

    constructor() {
        const apiKey = process.env.HYPIXEL_API_KEY;
        if (!apiKey) throw new Error('[HypixelAPI] Missing Hypixel API key in .env!');
        this.hypixel = new Client(apiKey);
    }

    public async getPlayer(username: string): Promise<Player | null> {
        try {
            const player = await this.hypixel.getPlayer(username);
            if (!player) return null;
            return player;
        } catch (error) {
            console.error(`[HypixelAPI] Error fetching player ${username}: ${error}`);
            return null;
        }
    }
}