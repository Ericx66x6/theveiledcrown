# Atualizar para A Coroa Velada 7

Esta atualização mantém seu Supabase, seus buckets e suas contas atuais. **Não precisa executar SQL novo**, apagar tabelas nem criar outro serviço. Faça um backup pelo painel antes de atualizar.

## 1. Enviar o código atualizado ao GitHub

1. Extraia o ZIP e abra a pasta `theveiledcrown`.
2. No repositório `Ericx66x6/theveiledcrown`, **apague o antigo `vercel.json`**. Esta versão usa **`vercel.mjs`** para encaminhar a API pelo mesmo domínio do site. Deixe apenas um dos dois: o arquivo desta versão é `vercel.mjs`.
3. Envie o conteúdo da pasta extraída para a raiz do repositório, substituindo os arquivos existentes. `package.json`, `vercel.mjs` e `render.yaml` precisam aparecer na raiz.
4. Envie também os arquivos iniciados por ponto que acompanham o pacote, como `.gitignore`. Se seu sistema os esconder, o GitHub Desktop facilita enviar a pasta inteira em um único commit.
5. Não envie o ZIP como um arquivo único, nem `node_modules`, `.git`, `.qa`, `dist` ou suas credenciais. O ZIP entregue não inclui essas pastas.

Se preferir atualizar pelo Git, o checkout do projeto pode receber os novos arquivos e as exclusões em um único commit. Isso evita que os serviços tentem compilar enquanto o upload ainda está incompleto.

## 2. Publicar primeiro a API no Render

Abra seu serviço atual no Render e confira:

| Configuração | Valor |
| --- | --- |
| Branch | `main` |
| Runtime | Node.js |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm start` |
| Node | `24` |
| Health check | `/api/health` |

Mantenha as variáveis atuais: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_IMAGE_BUCKET`, `BOOTSTRAP_TOKEN`, `NODE_ENV`, `NODE_VERSION`, `TRUST_PROXY` e `ALLOWED_ORIGINS`.

Confira especialmente **`TRUST_PROXY=1`** e **`ALLOWED_ORIGINS` com o domínio de produção do Vercel**. A URL do Supabase, a chave privada e o bucket continuam os mesmos. A chave privada fica somente no Render.

Use **Manual Deploy → Deploy latest commit**, se o deploy automático estiver desligado. Aguarde **Live** e abra o endereço do Render seguido de `/api/health`. A resposta deve mostrar **`version: "7.0.0"`**.

## 3. Publicar o frontend no Vercel

Abra o projeto existente e mantenha:

| Configuração | Valor |
| --- | --- |
| Framework | Other |
| Root directory | Raiz do repositório |
| Install | `npm ci --include=dev` |
| Build | `npm run build` |
| Output | `dist` |
| Node | 24.x |
| `COROA_API_BASE` | URL HTTPS atual do Render, sem `/api` nem outros caminhos |

O novo **`vercel.mjs`** declara os comandos e cria dois encaminhamentos: `/auth/...` e `/api/...` para o Render. O navegador passa a falar com a API pelo domínio do próprio site. Isso permite usar um cookie protegido de primeira parte para manter o login, inclusive em navegadores mobile que restringem cookies de terceiros.

Depois que a API 7 estiver Live, faça **Redeploy** no Vercel com o commit atualizado. Se o Vercel publicou automaticamente antes do Render terminar, republique após a API ficar pronta.

Se aparecer erro de dois arquivos de configuração, confira se o antigo `vercel.json` foi realmente removido do GitHub. Só arrastar os arquivos novos não apaga arquivos antigos do repositório.

## 4. Entrar uma vez e conferir

1. Abra o domínio de produção do Vercel e entre com sua conta atual. Não crie outro narrador nem importe um backup para fazer a atualização.
2. Atualize a página e feche/reabra a aba. O acesso deve ser restaurado automaticamente.
3. Clique em **Sair** para encerrar o acesso. A limpeza dos cookies do navegador também remove o acesso salvo. Desativação da conta e troca de senha continuam revogando sessões.
4. Confira as fotos em **Jogadores e acesso**, as notas com autoria, as notificações e o **Salão da campanha**.
5. No mapa, abra um marcador para ver a bolha e o dossiê. Você pode cadastrar até seis imagens e doze NPCs por local. Esses NPCs do local são separados dos murais pessoais dos personagens.
6. Para criar um mapa sem imagem, escolha **Mapa geográfico · OpenFreeMap**. A base usa dados do OpenStreetMap e renderização vetorial em Canvas, com zoom e arraste. Não precisa cadastrar chave de mapas. O serviço externo precisa estar disponível e o navegador precisa de internet.
7. Na missão, confira o rótulo **Recompensa prevista**. Ao clicar em **Entregar recompensa**, ajuste os valores finais, os itens e o desfecho. Depois da confirmação, a entrega é feita uma vez por missão.

O salão tem recados públicos para a campanha, recados privados entre participantes, cutucadas e lembretes com data no mural. Novos recados geram notificações aos destinatários. A presença se atualiza enquanto a campanha está aberta; ao sair ou ficar ausente, o participante deixa de aparecer como presente.

## 5. Entender as exclusões

| Ação | Resultado |
| --- | --- |
| Apagar anotação compartilhada | Autor ou narrador remove o registro da mesa |
| Apagar anotação privada | Somente seu autor tem acesso ao registro |
| Apagar recado público | Autor ou narrador remove o recado |
| Apagar recado privado recebido | Oculta o recado para o destinatário; o remetente conserva sua cópia |
| Apagar recado privado enviado | O remetente remove o recado |
| Apagar notificação | Altera somente a caixa da própria conta |
| Apagar missão concluída | Remove a missão, preservando as recompensas já entregues |
| Apagar movimentação/histórico | Narrador remove o registro sem mudar os valores atuais da ficha |
| Apagar rolagem | Responsável pela ficha ou narrador remove o resultado salvo |
| Remover ficha, conta ou mapa | Move para a lixeira, de onde o narrador pode restaurar |
| Apagar definitivamente/esvaziar lixeira | Remove os registros selecionados da recuperação pelo portal |
| Apagar campanha | Remove os dados daquela mesa e seus vínculos; preserva as contas e outras mesas |
| Zerar todo o portal | Remove contas e campanhas e volta à instalação inicial |

O reset completo fica em **Arquivos e backups → Limpar e recomeçar**. Ele exige digitar **ZERAR PORTAL**. Depois, a `BOOTSTRAP_TOKEN` do Render será necessária para cadastrar o primeiro narrador novamente. **Não use esse botão para instalar a atualização.**

As imagens sem referência permanecem no bucket privado para evitar apagar conteúdo necessário a backups anteriores. Elas não aparecem no portal reiniciado. O código não apaga buckets ou arquivos antigos de outros projetos.

## Se algo não carregar

- **Vercel com erro 404 na API:** confira se `vercel.mjs` está na raiz, se o antigo `vercel.json` saiu e se `COROA_API_BASE` aponta para o Render correto. Faça um novo deploy.
- **API informa versão 6:** publique o commit novo no Render antes de testar a interface 7.
- **Login não persiste:** use o endereço de produção do site, confira o encaminhamento acima e permita os cookies do próprio site. Faça um login após atualizar a API e o frontend.
- **Mapa geográfico não carrega:** a interface avisa quando a base externa não responde. Os locais continuam salvos e os mapas por imagem seguem disponíveis. Bloqueadores podem precisar permitir `tiles.openfreemap.org`.
- **Erro de origem:** confira `ALLOWED_ORIGINS` no Render com a origem exata do Vercel, sem barra final, e republique o serviço.
- **Tela de carregamento prolongada:** após alguns segundos aparece um aviso. Se interromper uma gravação, atualize e confira o resultado antes de repetir a ação.

O projeto foi validado com dados fictícios e testes locais de HTTP/SQL. Esta entrega não modifica automaticamente seus serviços ou os dados de produção.
