// Expo embeds only these public identifiers at bundle time.
export const config = {
  demo: process.env.EXPO_PUBLIC_AIRE_MODE === "demo",
  clientId: process.env.EXPO_PUBLIC_AIRE_CLIENT_ID,
  issuer: process.env.EXPO_PUBLIC_AIRE_ISSUER,
  identity: process.env.EXPO_PUBLIC_AIRE_IDENTITY,
  operations: process.env.EXPO_PUBLIC_AIRE_OPERATIONS,
};
