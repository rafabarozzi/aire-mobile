import * as Auth from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as Browser from "expo-web-browser";
import { jsonRequest } from "./operations.js";

import { config } from "./config";

Browser.maybeCompleteAuthSession();
const { issuer, identity, clientId } = config;
const key = "aire.mobile.identity.v1";
const secure = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
export const demoMode = config.demo;
export const clearSession = () => SecureStore.deleteItemAsync(key, secure);
export async function signIn() {
  if (
    !clientId ||
    !issuer?.startsWith("https://") ||
    !identity?.startsWith("https://")
  )
    throw new Error("SSO indisponível");
  const discovery = await Auth.fetchDiscoveryAsync(issuer);
  if (
    !discovery.authorizationEndpoint?.startsWith("https://") ||
    !discovery.tokenEndpoint?.startsWith("https://")
  )
    throw new Error("Provedor inválido");
  const redirectUri = Auth.makeRedirectUri({
    native: "com.northeia.aire://oauth/callback",
  });
  const request = new Auth.AuthRequest({
    clientId,
    redirectUri,
    usePKCE: true,
    scopes: ["openid", "aire.mobile"],
    responseType: Auth.ResponseType.Code,
  });
  const result = await request.promptAsync(discovery);
  if (result.type !== "success" || !result.params.code || !request.codeVerifier)
    throw new Error("Login não concluído");
  const token = await Auth.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier },
    },
    discovery,
  );
  await SecureStore.setItemAsync(key, token.accessToken, secure);
  try {
    const { organizations } = await jsonRequest(
      identity,
      "/mobile/v1/me",
      token.accessToken,
    );
    if (
      !Array.isArray(organizations) ||
      organizations.some((o) => !o.id || !o.name)
    )
      throw new Error("Organizações inválidas");
    return organizations;
  } catch (e) {
    await clearSession();
    throw e;
  }
}
export async function selectTenant(id) {
  const bearer = await SecureStore.getItemAsync(key, secure);
  if (!bearer) throw new Error("Sessão expirada");
  const result = await jsonRequest(
    identity,
    "/mobile/v1/organization-session",
    bearer,
    { organization_id: id },
  );
  if (
    result.tenant !== id ||
    !result.access_token ||
    !(Date.parse(result.expires_at) > Date.now())
  )
    throw new Error("Sessão inválida");
  return result;
}
