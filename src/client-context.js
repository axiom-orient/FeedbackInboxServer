// Client-reported diagnostic context, never an identity or authorization boundary.
export const contextFields = Object.freeze({
  appName: 128, appID: 128, appVersion: 64, appBuild: 64,
  osName: 32, osVersion: 64, deviceModel: 128, language: 64
});
export function encodeClientContext(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1
      || Object.keys(value).some(key => key !== 'schemaVersion' && !Object.hasOwn(contextFields, key))) {
    throw new Error('invalid_client_context');
  }
  const result = { schemaVersion: 1 };
  for (const [key, limit] of Object.entries(contextFields)) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'string' || !value[key].trim()
        || Array.from(value[key]).length > limit || /[\u0000-\u001f\u007f]/.test(value[key])) {
      throw new Error('invalid_client_context');
    }
    result[key] = value[key];
  }
  const encoded = JSON.stringify(result);
  if (new TextEncoder().encode(encoded).length > 2048) throw new Error('invalid_client_context');
  return encoded;
}
