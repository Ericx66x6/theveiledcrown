# The Veiled Crown · A Coroa Velada 6

Portal de RPG exclusivamente online: **Vercel → API Node.js no Render → Supabase**.

Leia **[TUTORIAL.md](TUTORIAL.md)** para instalar no seu repositório `Ericx66x6/theveiledcrown`. Inclui o passo a passo do Supabase, GitHub, Render, Vercel e do primeiro acesso.

- Node.js 24 e API que valida as permissões, custos e recompensas.
- Fichas, contas, regras e campanhas como documentos JSONB no Supabase.
- Mapas e retratos no bucket privado `coroa-imagens`, com referências nos documentos. As respostas e backups autorizados reconstituem as imagens.
- Site somente por HTTP/HTTPS; não inclui executável local, banco do navegador nem servidor Python.
- Backups JSON e ZIP permanecem disponíveis no painel do narrador.
- Missões atribuídas pelo narrador; conclusão direta ou solicitada pelo participante.
- Murais pessoais por personagem; vários personagens por conta e XP em lote.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `client/` | Interface e transporte HTTP |
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

As senhas são geridas pelo portal, com acesso de oito horas e token na memória da aba. As alterações são salvas na API. Outras abas verificam novas revisões a cada 20 segundos e ao recuperar o foco, preservando formulários em edição.

O SQL cria a nova estrutura sem apagar os buckets anteriores. A chave privada fica no Render. O Vercel recebe somente a URL pública da API.

[Permissões](docs/PERMISSOES.md) · [API](docs/API.md) · [Validação](VALIDACAO.md)
