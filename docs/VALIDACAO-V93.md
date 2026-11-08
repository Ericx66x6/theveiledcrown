# Validação da entrega 9.3.0

Verificada em 08/11/2026, com Node.js 24 e dados fictícios.

- `npm run test:all`: build concluído, **228 testes aprovados**, JavaScript e assets verificados.
- Presença: calendário e fuso, repetição no mesmo dia, quebra de sequência, ciclos repetidos, mudanças de configuração e independência entre campanhas.
- Resgate: confirmação, propriedade, revisão da ficha, preservação de créditos e duas solicitações simultâneas sem duplicar XP.
- Celebrações: recibos privados persistentes para XP, evolução e disciplina aprendida no nível zero; reconhecimento não apaga histórico ou notificações.
- Cadastro: senha mínima, acesso bloqueado antes de aprovação, liberação de campanhas pelo narrador, recusa e permissões na API HTTP.
- Persistência: novos campos passam pelo adaptador Supabase e pelas funções SQL reais executadas em PostgreSQL PGlite. Isso valida o contrato sem acessar o Supabase publicado da mesa.
- Áudio: migração dos padrões, efeitos/trilha independentes, silêncio geral e preservação das preferências posteriores.
- Catálogo: 44 rituais, 22 originais; IDs e níveis antigos preservados; testes reconhecidos e metas em 6+.
- JSON personalizado: parse, validação de regras e importação pela API. Disciplinas, características, antecedentes, criação, capítulos e custos anteriores comparados com a versão fornecida.

Na prévia HTTP do navegador, foram conferidos cadastro público, aprovação de um pedido fictício, configurações do narrador, resgate de XP, aprendizado de disciplina e evolução de atributo. XP pendente e quebra de sequência aparecem ao entrar. A interface de presença e as celebrações foram verificadas em largura de 360 px, sem rolagem horizontal. Veja [a prévia mobile](previa-mobile-v93.png).

A entrega contém o projeto para atualização. Não publica um deploy no Render, Vercel ou GitHub, nem altera os dados da campanha real. O roteiro está em **ATUALIZAR.md**; os novos recursos, em **docs/JOGO-VIVO.md**.
