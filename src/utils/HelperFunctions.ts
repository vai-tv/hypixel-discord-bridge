export function replaceVariables(message: string, data: Record<string, unknown>): string {
    return message.replace(/\{(\w+)\}/g, (match, key) => {
        return key in data && data[key] !== undefined ? String(data[key]) : match;
    });
}