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

const rawGuildWebhookUrl = getEnvVar('DISCORD_GUILD_WEBHOOK_URL', false);
const rawOfficerWebhookUrl = getEnvVar('DISCORD_OFFICER_WEBHOOK_URL', false);

export const environment = {
  discord: {
    token: getEnvVar('DISCORD_TOKEN'),
    guildServerId: getEnvVar('DISCORD_SERVER_ID', false),
    guildChatId: getEnvVar('DISCORD_GUILD_CHAT', false),
    officerChatId: getEnvVar('DISCORD_OFFICER_CHAT', false),
    debugChatId: getEnvVar('DISCORD_DEBUG_CHAT', false),
    guildWebhookUrl: isValidWebhookUrl(rawGuildWebhookUrl) ? rawGuildWebhookUrl : null,
    officerWebhookUrl: isValidWebhookUrl(rawOfficerWebhookUrl) ? rawOfficerWebhookUrl : null,
  },
  minecraft: {
    hypixelApiKey: getEnvVar('HYPIXEL_API_KEY', false),
  },
};

if (!environment.discord.guildWebhookUrl) {
  console.warn('[DISCORD Warning] Missing or invalid Discord guild webhook URL. Webhooks will not be used.');
}
if (!environment.discord.officerWebhookUrl) {
  console.warn('[DISCORD Warning] Missing or invalid Discord officer webhook URL. Webhooks will not be used.');
}