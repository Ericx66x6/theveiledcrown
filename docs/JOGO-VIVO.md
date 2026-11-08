# Jogo vivo · Beta 9.3.0

Esta atualização mantém a instalação online Render + Supabase + Vercel. Não exige novo SQL, bucket, chave ou serviço. Atualize a API e depois o frontend conforme **ATUALIZAR.md**.

## Presença na crônica

O narrador abre **Campanha → Recompensas de login → Configurar recompensa**. O padrão é **cinco dias consecutivos → 1 XP**, ligado, com fuso **America/Sao_Paulo**. Dias aceitam 1–60; XP, 1–10.000. Também é possível pausar novas presenças. A configuração vive no game-data:

```json
"login_rewards": {
  "enabled": true,
  "days": 5,
  "xp": 1,
  "time_zone": "America/Sao_Paulo"
}
```

Cada conta tem uma sequência independente por campanha. O servidor conta datas de calendário, com virada à meia-noite no fuso escolhido; não depende do relógio do aparelho nem de completar 24 horas desde o último acesso. Entrar, restaurar um login persistente ou voltar à aba registra a presença do dia, uma única vez. A página também oferece registro manual se necessário.

Ao completar um ciclo, o jogador ganha um **crédito de XP**, visível em **Presença na crônica** e em **Meus personagens**. Ele escolhe um personagem ativo, aprovado e pertencente à própria conta para receber. Uma recompensa não pode ser dividida entre fichas; contas sem personagem guardam o crédito até terem uma ficha aprovada. O resgate pede confirmação e registra o ganho no histórico e nas notificações. Cliques repetidos não entregam o XP novamente.

Perder um dia reinicia a sequência e o progresso do ciclo, com animação de corrente quebrada. XP já recebido e créditos guardados permanecem. O melhor recorde é conservado. Alterar dias, XP ou fuso reinicia o progresso no próximo dia válido; cada crédito anterior mantém os dias e o valor com que foi conquistado. Pausar o recurso não apaga créditos nem impede resgates em campanhas abertas. Campanhas encerradas não registram presenças nem permitem novos resgates.

## Conquistas e áudio

Evoluir atributos, habilidades, antecedentes ou disciplinas cria uma celebração persistente para o dono da ficha. Aprender uma disciplina no nível zero recebe uma apresentação própria; isso não concede níveis extras. Ganhos de XP, inclusive recompensas de missões e distribuição do narrador, geram recibos de celebração. Se o jogador estiver fora, os recibos aguardam seu próximo acesso. Ganhos consecutivos do mesmo personagem podem ser reunidos em uma tela.

Os recibos ficam nos JSONs privados da conta; o navegador não usa localStorage. Fechar a animação reconhece o recibo, sem remover notificações ou histórico. Se a conexão cair nesse reconhecimento, a celebração pode reaparecer no próximo acesso; o saldo continua sendo entregue uma única vez. A fila aguarda o fechamento de formulários e carregamentos. Há limite de 500 recibos ainda não reconhecidos, além de 50 recentes reconhecidos; isso não limita o histórico financeiro ou da ficha.

O botão de áudio mantém efeitos e trilha independentes, volumes próprios e **Silenciar tudo**. Novas contas e a apresentação começam com ambos ligados. Na primeira atualização de uma conta antiga, a trilha é ligada quando os efeitos gerais não estavam silenciados; depois, escolhas salvas pelo jogador são preservadas. Navegadores só liberam áudio depois de um toque/tecla; não é necessário mudar essa proteção do navegador. Sons de ganho de XP, evolução e novo dom têm assinaturas próprias. A trilha pausa com a aba oculta.

Movimentos de interface, brilho do XP, partículas e grandes celebrações respeitam **Reduzir animações** nas preferências e a preferência de movimento reduzido do aparelho. O carregamento mantém fundo escuro, indicação de espera e aviso de demora, sem a moldura branca do diálogo nativo.

## Entrada de novos jogadores

Na apresentação, **Criar minha conta** pede nome, login, senha com pelo menos dez caracteres, confirmação de senha e foto opcional. A imagem é reduzida no navegador. A API recebe no máximo 512 KiB nesse cadastro. A senha é armazenada pelo mesmo mecanismo de hash das contas existentes. A resposta não cria sessão nem concede acesso.

O narrador recebe uma notificação e encontra a fila em **Administração → Avaliar cadastros**. Aprovar exige escolher uma ou mais campanhas abertas. O jogador passa a poder entrar e criar propostas, ainda sem personagem próprio. Recusar mantém o acesso bloqueado. Cadastros removidos seguem a lixeira de contas; o login continua reservado enquanto o cadastro existir. O parecer da avaliação é interno, visível aos narradores.

## Catálogo de rituais

São **44 entradas**: as 18 anteriores mantêm IDs e níveis, quatro delas recebem revisão da referência, e entram mais 26 (quatro adaptações e 22 originais). No total, oito rituais adaptam brevemente conceitos da [compilação Bradock RPG](https://sites.google.com/site/bradockrpg/vampiro-a-mascara-rituais-tremere). A página reúne materiais de vários livros; esta versão não é uma transcrição de uma edição oficial.

Todos informam **Inteligência + Ocultismo**, meta por quantidade de sucessos em **6+**, Despertar, preparo, duração, materiais e limites. A consulta distingue **Original da Coroa**, **Adaptação da mesa** e **Ritual da mesa**. A descrição mantém o efeito separado dos dados de conjuração. O botão de preparar rolagem usa os valores do personagem e identifica a meta de sucessos; o narrador resolve resistências, aplicação e consequências.

Os IDs 5 e 8 continuam representando a Miragem da Sepultura: já existiam duplicados e foram preservados para não invalidar fichas. Os níveis antigos, inclusive os que diferem da referência, não foram alterados. Rituais excepcionais como Relíquia Mortuária e Passo de Vitae continuam marcados para autorização prévia. Efeitos sobre geração, fome, morte, durações e mapa são narrativos e manuais; consultar o catálogo não altera a ficha.

O `data/game_data.json` dentro do projeto é o livro inicial para instalações novas. Para atualizar sua campanha, importe **game_data_coroa_v9.3.0_validado.json** em **Livro de regras → Gerenciar livro → Importar game-data**. Esse arquivo mantém seus 83 registros de disciplinas, 283 características, 11 antecedentes, quatro capítulos personalizados e as configurações anteriores de Legados (custo geral 15 XP). Os novos rituais e a presença são acrescentados. Faça backup antes, como nas atualizações anteriores.

## Persistência e migração

As contas ganham `registration`, `login_rewards` e `reward_events` conforme usam as novas funções. Esses campos ficam nos documentos JSONB de conta existentes e seguem nos backups do portal e no ZIP de documentos. A API de jogador só retorna os próprios recibos e créditos da campanha atual. Narradores gerenciam cadastros; jogadores não alteram a configuração nem podem receber recompensas em fichas alheias.

O estado de teste do narrador continua isolado. Dados fictícios de prévia não são usados em `npm start`. Nenhum cadastro, celebração ou presença desta entrega depende de uma base offline no navegador.
