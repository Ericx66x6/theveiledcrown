# Permissões · Coroa Velada 10.1

| Recurso | Narrador | Jogador |
|---|---|---|
| Campanhas | Cria, edita, encerra e reabre | Entra nas campanhas vinculadas |
| Contas | Cria, ativa/inativa, remove/restaura e vincula acessos | Edita o próprio perfil e senha |
| Personagens | Cadastra, revisa, transfere, arquiva e remove/restaura | Usa as próprias fichas; propõe novos personagens para aprovação |
| Experiência | Concede/ajusta por ficha ou distribui para várias | Gasta o saldo individual na evolução validada |
| Regras e criação | Edita catálogos, capítulos, limites e custos | Consulta o conteúdo usado pela ficha; não altera regras |
| Missões | Cria, escolhe participantes e recompensas, edita e conclui | Consulta as atribuídas e a previsão de recompensa; não conclui nem entrega valores |
| Conclusão de missão | Ajusta a recompensa final e entrega uma vez | Consulta o resultado; não entrega recompensas |
| Mapas | Envia vários, libera acesso, gerencia e remove/restaura | Abre os liberados e cria/edita seus próprios marcadores |
| Local privado no mapa | Acessa se for autor | Acessa se for autor |
| Posição pessoal de personagem | Vê, cria, move e remove todas; preserva a escolha de visibilidade | Controla as próprias e vê posições compartilhadas |
| Círculo de relações | Não abre nem edita pela aplicação | Mural separado de cada personagem sob seu controle |
| Diário compartilhado | Lê e administra registros compartilhados | Lê e cria; edita os seus |
| Anotação privada | Acessa somente as próprias | Acessa somente as próprias |
| Anotação de narradores | Acessa | Sem acesso |
| Backup completo | Exporta/importa todo o portal | Exporta seu pacote autorizado |
| Notificações | Avaliações e pedidos da campanha | Avisos destinados à própria conta |

As permissões são verificadas na camada de serviço e no servidor. Ocultar botões não é a autorização. IDs enviados por um jogador não concedem acesso a outras fichas, mapas, murais ou campanhas.

Uma ficha tem um responsável por vez. Transferi-la também transfere o acesso ao mural daquele personagem. Várias fichas da mesma conta continuam com murais separados. O narrador abre sem ficha selecionada e não possui um personagem próprio.

Os backups administrativos completos contêm os dados integrais para recuperação, inclusive relações pessoais. O bloqueio do mural aplica-se à interface e às rotas normais; não impede o proprietário do banco ou de um backup de inspecionar seus próprios dados. Para jogadores, os pacotes filtram conteúdo e acessos alheios. O backup completo fica com o administrador.

Não há relógio, calendário ou contagem de sessões do mundo. Datas reais de histórico e segurança continuam sendo metadados do sistema.

## Comunidade e exclusões

Perfis públicos são consultáveis somente dentro de uma campanha compartilhada. A API retorna nome, bio, foto, papel e personagens públicos, sem senhas ou dados de sessão. Publicações públicas antigas do salão são migradas para as anotações compartilhadas, que podem ser apagadas pelo autor e pelo narrador. O salão aceita somente interações com destinatário. Mensagens privadas ficam entre remetente e destinatário; o narrador não recebe essas conversas pelas rotas normais. Notificações são apagadas apenas da própria caixa.

O narrador pode apagar missões, campanhas, históricos, movimentações e registros da lixeira. Apagar um registro financeiro não altera o saldo. O responsável pela ficha pode apagar suas rolagens. O autor ou narrador pode apagar propostas sem remover personagens já aprovados. O reset exige narrador e confirmação textual, remove contas e volta à instalação inicial. Backups completos continuam contendo os dados necessários à recuperação.

O login persiste por cookie HttpOnly, com verificação de origem nas alterações. Sair e revogar/trocar o acesso invalidam as sessões no servidor.

## Novos controles da versão 8

| Recurso | Narrador | Jogador |
| --- | --- | --- |
| Cor e capa da campanha | Configura | Visualiza |
| Informação ainda velada | Cadastra/edita/apaga e consulta conteúdo | Vê apresentação e preço |
| Compra de informação | Administra o catálogo | Confirma pagamento completo com uma ficha própria |
| Informação revelada | Consulta e administra | Todos da campanha consultam, com identificação do comprador |
| Catálogo de legados | Libera/restringe disciplinas | Adquire as permitidas pelo custo configurado, no nível 0 |
| Marcador pessoal | Vê e posiciona todos os personagens | Move seus personagens e decide compartilhar ou reservar |
| Escala por imagem | Calibra | Usa para medir a distância |
| Histórico de ficha | Pode apagar e acrescentar mensagem ao editar | Consulta; evoluções e gastos são registrados pelo servidor |
| Mensagem, brinde, pergunta e desafio | Interage como pessoa da mesa | Interage com participantes da mesma campanha |
| Mensagens entre outras contas | Sem acesso pelas rotas normais | Sem acesso |

As cópias administrativas completas continuam contendo dados de recuperação. A restrição de mensagens e anotações privadas se refere às telas e rotas normais de consulta. Notas pessoais acompanham seu autor; o círculo de relações continua exclusivo do personagem e não é o cadastro de NPCs dos mapas.

Ambição e desejo pertencem à ficha: o jogador altera e encerra os próprios objetivos; o narrador pode administrar a ficha. Outros jogadores não têm acesso a esses textos pelas rotas normais. Conclusão/desistência conserva o registro no histórico, cuja exclusão continua exclusiva do narrador. Enquadramento do retrato segue a mesma propriedade. O narrador define preço geral e preço individual dos legados; jogadores confirmam o custo que o servidor confere antes de cobrar.

## Posições e modo de testes (9.1)

O narrador pode criar, mover e remover posições de personagens ativos. Cada jogador controla apenas seus personagens e decide se os outros jogadores veem sua posição. Movimentos do narrador preservam essa decisão.

**Testar como jogador** cria um workspace isolado e uma conta temporária com papel de jogador, vinculada somente à ficha de teste. Não muda o papel do narrador, sua senha ou seus vínculos na campanha real. O teste não recebe notas privadas, murais pessoais, mensagens ou contas de jogadores reais. A navegação administrativa permanece bloqueada no servidor e no cliente.

## Criação e leitura (9.2.1)

Jogadores distribuem os pontos iniciais e bônus em uma proposta; não alteram os custos do catálogo, não digitam livremente geração/XP/capital e não aprovam personagens. O servidor reconstrói a ficha pelas escolhas, valida limites, exige gasto integral das reservas e calcula Geração e Recursos. Com o assistente ativo, jogadores não podem enviar nem reenviar uma ficha removendo o plano de pontos. Qualidades e defeitos usam os pontos bônus. Um clã personalizado continua dependendo da aprovação manual.

O narrador consulta o livro sem abrir edição; Gerenciar livro habilita os formulários. Continua podendo transcrever fichas, ajustar propostas e aprovar exceções justificadas. Atualizar regras não recalcula fichas antigas nem concede capital novamente. Propostas legadas sem etapas registradas precisam de conferência manual.

## Memórias e vínculos (10.1)

| Recurso | Narrador | Jogador |
| --- | --- | --- |
| Onde paramos? | Lê relatos das fichas, solicita complemento, registra leitura, concede +1 XP uma vez e remove registros | Escreve rascunhos de personagens próprios, envia e complementa quando solicitado; não aprova nem premia |
| XP de relato | Entrega somente à ficha do relato ainda pertencente ao autor | Recebe, com histórico e notificação; não escolhe outro destinatário |
| Galeria da eternidade | Consulta galerias de jogadores da campanha, concede/remove feitos e títulos | Consulta a própria galeria de todas as campanhas; pode reconhecer a celebração mesmo sem campanha vinculada |
| Documentos | Cria, edita, remove, escolhe destinatários e consulta todos | Lê somente os públicos da campanha ou destinados à própria conta |
| Voz da mesa | Lê feedbacks, responde, concede XP variável uma vez para uma ficha do autor e remove | Envia feedback privado; edita/remove antes da avaliação; consulta resposta e recompensa |
| Laços de sangue | Consulta e ajusta fichas, com revisão e histórico | Mantém os vínculos dos próprios personagens; não lê nem altera vínculos alheios |

Os relatos acompanham a história da ficha. Transferir o personagem permite ao novo responsável consultar esse histórico, mas não editar relatos de outro autor nem receber a recompensa pelo texto dele. Um jogador pode manter vários relatos independentes em personagens diferentes. Feedback pertence ao autor e permanece privado entre ele e os narradores.

Acesso restrito a documento usa IDs de contas da campanha, não de personagens. Uma lista vazia restringe aos narradores. A API filtra conteúdo e imagem; ocultar a opção na interface não é a proteção. Recolher acesso não apaga cópias que alguém já tenha baixado.

Conquistas pertencem à pessoa: transferir/excluir uma ficha ou mudar de campanha não apaga o que ela conquistou. Remover uma marca da galeria é controle do narrador e não desfaz níveis, XP ou histórico de ficha. A avaliação de qualidade dos relatos/feedbacks continua humana; quantidade de palavras nunca concede XP automaticamente.

Laços usam tempo narrativo manual, sem calendário. Alterar estágio não reduz nível; enfraquecimento exige confirmação. Quem controla a ficha pode ajustar os níveis para refletir o roleplay, sempre registrado no histórico. O narrador continua sendo o único que pode apagar o histórico da ficha.

As novas áreas também funcionam no modo Testar como jogador dentro do workspace temporário. Relatos, feedbacks e alterações de vínculo desse teste não são gravados na campanha real.
