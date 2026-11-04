# AIRE Mobile

Central de situação para gestão, com um aplicativo React Native para iOS e Android. A demonstração abre com **Banco Varejo**, que reúne três incidentes simultâneos, e **Banco Relacional**, que tem uma jornada sem leitura de saúde e nenhum incidente ativo. Os dados são inteiramente sintéticos.

## Executar no celular

Use Node 22.13+ ou 24.3+, npm e um ambiente nativo de desenvolvimento Android ou iOS. O lockfile fixa as versões avaliadas do Expo SDK 56 e do React Native 0.85.

```sh
npm ci
cp .env.example .env.local

# Gere os projetos nativos com o template correspondente ao SDK 56.
AIRE_TEMPLATE_DIR=$(mktemp -d)
npm pack expo-template-bare-minimum@56.0.38 --pack-destination "$AIRE_TEMPLATE_DIR"
npx expo prebuild --no-install --template "$AIRE_TEMPLATE_DIR/expo-template-bare-minimum-56.0.38.tgz"

npm run android -- --device
# Em macOS, com Xcode e o dispositivo pareado:
npm run ios -- --device
```

O comando da plataforma escolhida instala o development build e inicia o Metro. Depois, use `npm start` na mesma rede do aparelho e abra o build já instalado. Android exige SDK e depuração USB autorizada. No iPhone, configure a equipe de assinatura no Xcode e habilite o modo de desenvolvedor. Simulador iOS ou emulador Android também servem para o fluxo sintético. O callback de autenticação e os plugins nativos exigem um build do próprio app. Para regenerar após mudanças em plugins, repita o prebuild com o mesmo template e `--clean` em uma árvore limpa.

Para homologação corporativa remova `EXPO_PUBLIC_AIRE_MODE=demo`, preencha os quatro identificadores públicos indicados no exemplo e reinicie o Metro. O modo corporativo exige os serviços descritos no [contrato de integração](docs/integracao.md). O login não cai automaticamente para a demonstração.

## Conferência funcional

1. Entre na demonstração e escolha Banco Varejo. Confira Pix em primeiro lugar, com comunicação atrasada. Em Compras, a previsão está vencida.
2. Abra dois incidentes, percorra as linhas do tempo e favorite um incidente e uma jornada. Alterne o filtro de favoritos.
3. No incidente Pix, toque em **Acessar sala** para ver o resultado sintético da autorização. A sala de Compras ainda está solicitada.
4. Em **Cenários de teste**, simule falha e offline após uma leitura. Confira a hora da última sincronização, o aviso e a consulta do detalhe já visitado. Retorne à operação normal.
5. Selecione P1 e Pix, registre o dispositivo simulado e teste a notificação. Repetir o evento demonstra a deduplicação. Revogue o registro.
6. Troque para Banco Relacional. A lista de incidentes está vazia, a saúde consta como **Sem leitura** e não há favoritos herdados. Encerre a sessão.
7. Verifique modo escuro/claro, tamanho de fonte ampliado, VoiceOver e TalkBack, navegação de retorno e leitura do aviso de atualização.

```sh
npm test
EXPO_PUBLIC_AIRE_MODE=demo npx expo export --platform all
```

O segundo comando gera os bundles Hermes de ambas as plataformas. A execução nativa, SSO com os provedores reais e a entrega APNs/FCM têm critérios separados no contrato.
