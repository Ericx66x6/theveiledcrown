# The Veiled Crown · A Coroa Velada 9.2 · Beta

Portal de RPG exclusivamente online: **Vercel → API Node.js no Render → Supabase**.

Já usa a versão 6, 7 ou 8? Siga **[ATUALIZAR.md](ATUALIZAR.md)** para preservar seus dados. Para instalar do zero, leia **[TUTORIAL.md](TUTORIAL.md)** para instalar no seu repositório `Ericx66x6/theveiledcrown`. Inclui o passo a passo do Supabase, GitHub, Render, Vercel e do primeiro acesso.

- Node.js 24 e API que valida as permissões, custos e recompensas.
- Fichas, contas, regras e campanhas como documentos JSONB no Supabase.
- Mapas e retratos no bucket privado `coroa-imagens`, com referências nos documentos. As respostas e backups autorizados reconstituem as imagens.
- Site somente por HTTP/HTTPS; não inclui executável local, banco do navegador nem servidor Python.
- Backups JSON e ZIP permanecem disponíveis no painel do narrador.
- Missões com recompensa prevista e entrega final ajustável, exclusiva do narrador.
- Salão fora do jogo: presença, mensagens privadas, brindes, cutucadas e desafios sociais.
- Ecos do Véu: informações com custo em XP/dinheiro, pagamento único e descoberta para toda a mesa.
- Legados do Sangue: disciplinas autorizadas pelo narrador, com custo geral e individual definido pelo narrador, começando no nível 0.
- Tema e capa por campanha, efeitos e trilha ambiente com controles próprios, busca global e testes automáticos das disciplinas.
- Narrador posiciona qualquer personagem ativo; jogador move apenas os seus. A privacidade permanece sob controle do jogador. Reposicionamento por toque ou dois toques e arraste.
- Modo **Testar como jogador** no acesso do narrador: ficha temporária, regras e mapas da campanha, compras e interações isoladas. Nada altera as fichas reais; voltar descarta o teste.
- Marcadores pessoais com privacidade e distância em quilômetros, com escala por imagem ou coordenadas.
- Anotações centralizadas; ambição e desejo em área própria, com confirmação e animações de conquista/desistência.
- Consulta de disciplinas antes da evolução, busca por poderes/rituais e navegação Voltar/Avançar preservando o contexto.
- Retratos com enquadramento ajustável e mapa compacto no mobile.
- Favicon, ícones mobile, Open Graph e imagem de compartilhamento próprios.
- Histórico com mensagem de edição do narrador.
- Atlas por imagem ou mapa vetorial OpenFreeMap; locais com imagens e NPCs.
- Exclusões, limpeza de históricos, lixeira e reset com confirmação.
- Murais pessoais por personagem; vários personagens por conta e XP em lote.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `client/` | Interface, transporte HTTP, comunidade e atlas |
| `core/` | Regras, modelos, permissões e serviços |
| `server/` | API, Supabase e imagens privadas |
| `shared/` | Componentes e regras compartilhadas |
| `public/images/` | Arte da apresentação |
| `data/game_data.json` | Livro inicial de regras |
| `supabase/INSTALAR.sql` | Instalação das tabelas, funções e bucket |
| `tests/` | Testes e dados fictícios |
| `dist/` | Frontend gerado; não precisa ser enviado ao GitHub |

## Comandos

```sh
npm ci
npm run test:all
npm start
```

`npm start` precisa da configuração do Supabase no ambiente. `npm run build` gera `dist/`. No Vercel, configure `COROA_API_BASE` antes do build. No Render, configure as variáveis de `.env.render.example`.

O acesso é restaurado por cookie persistente HttpOnly; o navegador não usa localStorage ou IndexedDB. No Vercel, `vercel.mjs` encaminha a API pelo domínio do próprio site. Sair, trocar a senha ou revogar a conta encerra o acesso. As alterações são salvas na API. Outras abas verificam novas revisões a cada 20 segundos e ao recuperar o foco, preservando formulários em edição.

O SQL cria a nova estrutura sem apagar os buckets anteriores. A chave privada fica no Render. O Vercel recebe somente a URL pública da API.

[Permissões](docs/PERMISSOES.md) · [API](docs/API.md) · [Validação](VALIDACAO.md)

Os motores de mapa são carregados conforme a necessidade: Leaflet para imagens e OpenLayers para a base vetorial, sem exigir WebGL. Os créditos dos dados e provedores permanecem visíveis no mapa.

A versão 9.2 inclui consulta sem edição no livro e criação guiada com pontos iniciais, bônus, clãs, linhas, geração e capital. Veja [docs/CRIACAO.md](docs/CRIACAO.md) e [ATUALIZAR.md](ATUALIZAR.md).
