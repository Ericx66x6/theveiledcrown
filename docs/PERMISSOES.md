# Permissões · Coroa Velada 8

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
| Posição pessoal de personagem | Vê todas | Controla as próprias e vê posições compartilhadas |
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
| Catálogo de legados | Libera/restringe disciplinas | Adquire as permitidas por 10 XP, no nível 0 |
| Marcador pessoal | Vê todas as posições | Move seus personagens e decide compartilhar ou reservar |
| Escala por imagem | Calibra | Usa para medir a distância |
| Histórico de ficha | Pode apagar e acrescentar mensagem ao editar | Consulta; evoluções e gastos são registrados pelo servidor |
| Mensagem, brinde, pergunta e desafio | Interage como pessoa da mesa | Interage com participantes da mesma campanha |
| Mensagens entre outras contas | Sem acesso pelas rotas normais | Sem acesso |

As cópias administrativas completas continuam contendo dados de recuperação. A restrição de mensagens e anotações privadas se refere às telas e rotas normais de consulta. Notas pessoais acompanham seu autor; o círculo de relações continua exclusivo do personagem e não é o cadastro de NPCs dos mapas.
