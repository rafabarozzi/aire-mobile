import React from "react";
import { configure } from "@testing-library/react-native";
configure({ asyncUtilTimeout: 8000 });
jest.setTimeout(45000);
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import App from "../App";
jest.mock("../src/auth", () => ({
  demoMode: true,
  clearSession: jest.fn(async () => {}),
}));
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: () => () => {},
}));
jest.mock("expo-notifications", () => ({
  getLastNotificationResponse: () => null,
  addNotificationResponseReceivedListener: () => ({ remove() {} }),
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

async function enter() {
  render(<App />);
  const login = screen.getByText("Entrar na demonstração");
  await waitFor(() => expect(login).toBeEnabled());
  fireEvent.press(login);
  fireEvent.press(await screen.findByRole("button", { name: "Banco Varejo" }));
  await screen.findByText("Transferências Pix interrompidas");
}
test("navega no incidente e descarta dados da organização ao trocar ou sair", async () => {
  await enter();
  fireEvent.press(screen.getByText("Acompanhar · Pagamentos"));
  await screen.findByText("Linha do tempo");
  fireEvent.press(screen.getByText("Favoritar incidente"));
  fireEvent.press(screen.getByText("‹ Voltar à central"));
  fireEvent.press(screen.getByText("Ver favoritos · 1"));
  expect(screen.getByText("Transferências Pix interrompidas")).toBeTruthy();
  expect(screen.queryByText("Compras com autorização lenta")).toBeNull();
  fireEvent.press(screen.getByText("Trocar organização"));
  fireEvent.press(screen.getByText("Banco Relacional"));
  await screen.findByText("Nenhum incidente ativo.");
  expect(screen.getByText("Sem leitura")).toBeTruthy();
  expect(screen.getByText("Ver favoritos · 0")).toBeTruthy();
  fireEvent.press(screen.getByText("Encerrar sessão"));
  await screen.findByRole("button", { name: "Entrar na demonstração" });
  expect(screen.queryByText("Antecipação de recebíveis")).toBeNull();
});
test("falha e modo offline preservam a leitura anterior e permitem recuperação", async () => {
  await enter();
  fireEvent.press(screen.getByText("Simular erro de leitura"));
  await screen.findByText(/Falha ao consultar/);
  expect(screen.getByText("Dados desatualizados")).toBeTruthy();
  fireEvent.press(screen.getByText("Simular offline"));
  expect(screen.getByText(/Offline ·/)).toBeTruthy();
  expect(screen.getByText("Transferências Pix interrompidas")).toBeTruthy();
  fireEvent.press(screen.getByText("Operação normal"));
  await waitFor(() =>
    expect(screen.queryByText("Dados desatualizados")).toBeNull(),
  );
});
