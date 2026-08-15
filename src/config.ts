import 'dotenv/config';

function getEnvVar(key: string, required = true): string {
  const value = process.env[key]?.trim();
  if (required && (!value || value === `your_${key.toLowerCase()}_here`)) {
    throw new Error(`[Config Error] Missing or unconfigured environment variable: ${key}`);
  }
  return value || '';
}

function isValidWebhookUrl(url: string): boolean {
  if (!url) return false;
  return /^https:\/\/(ptb\.|canary\.)?discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url);
}

const rawWebhookUrl = getEnvVar('DISCORD_WEBHOOK_URL', false);

export const config = {
  discord: {
    token: getEnvVar('DISCORD_TOKEN'),
    guildServerId: getEnvVar('DISCORD_SERVER_ID', false),
    guildChatId: getEnvVar('DISCORD_GUILD_CHAT', false),
    officerChatId: getEnvVar('DISCORD_OFFICER_CHAT', false),
    debugChatId: getEnvVar('DISCORD_DEBUG_CHAT', false),
    webhookUrl: isValidWebhookUrl(rawWebhookUrl) ? rawWebhookUrl : null,
  },
  minecraft: {
    email: getEnvVar('MC_EMAIL'),
    auth: (getEnvVar('MC_AUTH', false) || 'microsoft') as 'microsoft',
    hypixelApiKey: getEnvVar('HYPIXEL_API_KEY', false),
  },
};

if (!config.discord.webhookUrl && rawWebhookUrl) {
  console.warn('[Config Warning] DISCORD_WEBHOOK_URL is invalid. Webhook features will fallback to text channel messages.');
}