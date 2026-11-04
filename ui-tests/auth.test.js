jest.mock("expo-auth-session", () => ({
  makeRedirectUri: ({ native }) => native,
  ResponseType: { Code: "code" },
  AuthRequest: jest.fn(),
  fetchDiscoveryAsync: jest.fn(),
  exchangeCodeAsync: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("../src/operations.js", () => ({ jsonRequest: jest.fn() }));
const Auth = require("expo-auth-session"),
  store = require("expo-secure-store");
const { jsonRequest } = require("../src/operations.js");
jest.mock("../src/config", () => ({
  config: {
    clientId: "public-mobile",
    identity: "https://identity.example",
    issuer: "https://login.example",
  },
}));
const client = require("../src/auth");
beforeEach(() => jest.clearAllMocks());
test("troca código com verificador PKCE, protege bearer e consulta organizações autorizadas", async () => {
  const discovery = {
    authorizationEndpoint: "https://login.example/auth",
    tokenEndpoint: "https://login.example/token",
  };
  Auth.fetchDiscoveryAsync.mockResolvedValue(discovery);
  Auth.AuthRequest.mockImplementation(() => ({
    codeVerifier: "test-verifier",
    promptAsync: async () => ({ type: "success", params: { code: "one-use" } }),
  }));
  Auth.exchangeCodeAsync.mockResolvedValue({ accessToken: "test-bearer" });
  jsonRequest.mockResolvedValue({
    organizations: [{ id: "a", name: "Org A" }],
  });
  await expect(client.signIn()).resolves.toEqual([{ id: "a", name: "Org A" }]);
  expect(Auth.AuthRequest).toHaveBeenCalledWith(
    expect.objectContaining({ clientId: "public-mobile", usePKCE: true }),
  );
  expect(Auth.exchangeCodeAsync).toHaveBeenCalledWith(
    {
      clientId: "public-mobile",
      code: "one-use",
      extraParams: { code_verifier: "test-verifier" },
      redirectUri: "com.northeia.aire://oauth/callback",
    },
    discovery,
  );
  expect(store.setItemAsync).toHaveBeenCalledWith(
    "aire.mobile.identity.v1",
    "test-bearer",
    expect.any(Object),
  );
  expect(jsonRequest).toHaveBeenCalledWith(
    "https://identity.example",
    "/mobile/v1/me",
    "test-bearer",
  );
  jsonRequest.mockRejectedValueOnce(new Error("Acesso negado"));
  await expect(client.signIn()).rejects.toThrow();
  expect(store.deleteItemAsync).toHaveBeenCalled();
});
test("rejeita token de outra organização ou sessão vencida", async () => {
  store.getItemAsync.mockResolvedValue("synthetic");
  jsonRequest
    .mockResolvedValueOnce({
      tenant: "other",
      access_token: "token",
      expires_at: new Date(Date.now() + 60000).toISOString(),
    })
    .mockResolvedValueOnce({
      tenant: "a",
      access_token: "token",
      expires_at: "2020-01-01T00:00:00Z",
    });
  await expect(client.selectTenant("a")).rejects.toThrow("Sessão inválida");
  await expect(client.selectTenant("a")).rejects.toThrow("Sessão inválida");
});
