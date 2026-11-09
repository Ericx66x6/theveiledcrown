# Criação guiada · 10.2

O acesso de jogador usa **Meus personagens → Criar personagem**. O narrador continua podendo transcrever fichas manualmente e ajustar propostas antes da aprovação. **Testar como jogador** também permite experimentar o assistente, sem gravar na campanha real.

## Passo a passo obrigatório

1. Nome, clã, três disciplinas e linha inicial quando necessária.
2. Atributos: distribua todos os 15 pontos extras.
3. Habilidades: distribua todos os 27 entre os três grupos.
4. Antecedentes: distribua todos os 5 pontos.
5. Disciplinas: distribua exatamente 3 pontos entre os dons do clã.
6. Qualidades e defeitos: escolha os opcionais antes de distribuir bônus.
7. Bônus em atributos.
8. Bônus em habilidades.
9. Bônus em antecedentes.
10. Bônus em disciplinas.
11. Revisão e envio para aprovação.

Cada reserva inicial tem uma tela e só libera a seguinte com gasto exato. As abas de talentos, perícias e conhecimentos compartilham a mesma reserva. O menu permite voltar; avançar acontece somente pelo botão de continuar. Alterar uma etapa anterior exige conferir as seguintes novamente, mantendo as escolhas.

Os bônus formam **uma única reserva**, não uma reserva por categoria. O jogador escolhe quanto gastar em cada tela e segue a ordem, mesmo se decidir não comprar nada naquela categoria. Ao terminar as disciplinas, qualquer sobra leva a **mais uma volta pelos atributos → habilidades → antecedentes → disciplinas**. Só abre a revisão quando a reserva chega a zero e as regras estão atendidas. Por exemplo, um bônus restante pode comprar um ponto de antecedente numa nova volta, sem descartar pontos.

Qualidades e defeitos podem devolver investimentos quando fixam um atributo ou reduzem seu limite. O assistente informa isso, oferece **Reajustar** na etapa correspondente e preserva o resto da ficha. Requisitos compráveis com bônus, como Carisma 3 para Líder Nato, podem ser atendidos na categoria apropriada antes do envio.

## Pontos

| Reserva | Distribuição | Limite inicial |
| --- | --- | --- |
| Atributos | Base 1, mais 15 pontos; Aparência Nosferatu fixa em 0 | 4 |
| Habilidades | 27 entre talentos, perícias e conhecimentos | 3 |
| Antecedentes | 5 pontos | 5 |
| Disciplinas | 3 pontos entre os três dons do clã | 3 |

As três disciplinas são conservadas mesmo no nível 0. A linha primária escolhida não é um quarto gasto: acompanha o nível da disciplina que a concede. Na evolução posterior, o vínculo em `primary_paths` mantém os dois registros sincronizados com uma única cobrança de XP. Linhas secundárias e rituais continuam separados.

| Compra com os 15 pontos bônus | Custo por +1 nível |
| --- | --- |
| Atributo | 4 |
| Habilidade | 2 |
| Disciplina | 6 |
| Antecedente | 1 |

Na segunda distribuição, o limite é 5, sujeito às restrições das características. Até quatro defeitos concedem seu valor em bônus. Qualidades consomem seu preço; não se usa XP. Versões do mesmo defeito/qualidade não são somadas quando compartilham `mutually_exclusive_group`. Retirar um defeito devolve seus pontos à contagem e pode exigir reduzir compras. **Nenhum ponto inicial ou bônus pode sobrar no envio.** Retirar um defeito pode deixar a reserva negativa; reduza as compras ou escolha outra combinação válida antes de continuar.

## Geração e capital

Geração é calculada por `13 − antecedente Geração`, até 8. O jogador não digita livremente a geração. A potência inicial usa o mínimo da geração no game-data.

| Recursos | Capital inicial |
| --- | --- |
| 0 | R$ 0 |
| 1 | R$ 1.000 |
| 2 | R$ 8.000 |
| 3 | R$ 50.000 |
| 4 | R$ 500.000 |
| 5 | R$ 5.000.000 |

O capital entra no saldo da ficha uma vez, quando ela é criada/aprovada. `starting_money`, se configurado, é um adicional. Reabrir o site, alterar Recursos depois de jogar, importar regras ou repetir uma aprovação não concede dinheiro novamente. Esta mesa converte o patrimônio da referência em capital inicial; não há calendário ou renda automática.

Os antecedentes mantêm seus IDs anteriores e recebem descrições e níveis. **Escravos Espirituais** foi incluído para Giovanni; as capacidades dos fantasmas dependem do narrador. Ter pontos em Aliados, Contatos ou Lacaios não inventa pessoas: os detalhes podem ser cadastrados na ficha após a aprovação.

## Características que alteram a ficha

O cálculo usa os IDs do catálogo e metadados `creation_effects`, sem executar código vindo do JSON. Exemplos implementados:

- Monstruoso fixa Aparência em 0; o assistente devolve os investimentos que estiverem nesse atributo. Não gera pontos pelo reembolso da base gratuita.
- Criança limita Força/Vigor a 2 e exige Estatura Baixa.
- Líder Nato exige Carisma 3; Tolerância à Dor exige Coragem 3.
- Consumo Conspícuo exige Ingerir Comida; Coração Mole confere Humanidade mínima.
- Beijo de Procuração concede +1 Potência; a versão de 8 pontos também concede Fortitude 1, podendo acrescentá-la fora do trio de clã. Esses níveis não gastam o pool inicial uma segunda vez.
- Taumaturgicamente Inapto confere o limite inicial de Taumaturgia. Resistência a Magia confere suas incompatibilidades.

Bônus condicionais, cura, alimentação, favores, acontecimentos e alterações futuras por roleplay continuam sendo aplicados pelo narrador conforme a descrição. O assistente não aumenta permanentemente um atributo por causa de um bônus de dados que só vale numa situação. Características filtradas continuam fora da compra padrão.

O cadastro avançado pode manter efeitos, requisitos, grupos de exclusão e restrições. Exemplo de limite/requisito:

```json
{
  "creation_effects": {
    "attribute_caps": [{ "id": 0, "value": 2 }],
    "requires_traits": [133]
  }
}
```

Os números do exemplo são IDs e devem corresponder ao catálogo da campanha. Os campos aceitos são `attribute_set`, `attribute_caps`, `discipline_grants`, `discipline_caps`, `minimums`, `requires_traits`, `excludes`, `requires_clans`, `forbidden_clans`, `forbidden_disciplines` e `humanity_min`. Consulte uma característica existente antes de editar o JSON; o servidor recusa referências desconhecidas.

## Aprovação e compatibilidade

Cada proposta guarda `character.creation` com as duas distribuições, escolhas de clã, linhas e características. O servidor exige que cada reserva inicial e a reserva final de bônus estejam totalmente utilizadas, inclusive no reenvio. Quando a criação guiada está ativa, novos envios de jogadores sem o plano de pontos são recusados. O servidor reconstrói os valores; dinheiro, XP, geração ou pontos finais enviados pelo cliente não são aceitos como cálculo confiável. O narrador recebe o relatório e a notificação, pode pedir ajustes, editar e aprovar. Exceções que alterem o resultado calculado exigem confirmação e justificativa.

O clã personalizado exige nome e três disciplinas. A aprovação do narrador permanece obrigatória, inclusive quando a contagem está correta. As listas dos clãs seguem as combinações fornecidas por Eric, sem substituir por outra edição do jogo.

Fichas já aprovadas continuam com os saldos e gerações atuais. Propostas anteriores ao assistente permanecem disponíveis para análise manual do narrador. Ao editá-las pelo acesso de jogador, o assistente preserva nome e narrativa e pede uma nova distribuição; os valores antigos não são inventados como gastos iniciais ou bônus. A validação de novas regras não aplica retroativamente capital ou efeitos de criação nas fichas antigas.

No livro, **Consultar → Visualizar** abre conteúdo completo sem edição. **Gerenciar livro → Regras e criação de fichas** permite alterar as reservas e custos. `character_creation.guided` guarda os demais parâmetros em JSON. O modelo do projeto atende instalações novas; em campanhas existentes, importe o game-data atualizado após fazer backup, seguindo **ATUALIZAR.md**.

Referência de antecedentes: https://vampiros-a-mascara.forumeiros.com/t99-antecedentes. Valores e efeitos da criação foram adaptados às regras da mesa, sem reintroduzir pontos de sangue ou dificuldade por face do dado.

## Apresentação para iniciantes (10.2)

O jogador explora os clãs pelo retrato e só confirma em **Escolher [clã]**. As abas apresentam conceito, ideologia, exemplos de personagens, disciplinas e fraqueza. Os exemplos orientam sem restringir a interpretação; não há rivalidades obrigatórias. Os resumos se baseiam na 3ª edição/Revised e as combinações de poderes mantêm as regras da mesa. Fontes e distinções estão em [CLAS-E-REFERENCIAS.md](CLAS-E-REFERENCIAS.md).

Caitiff escolhe três disciplinas diferentes entre Animalismo, Auspícios, Rapidez, Dominação, Fortitude, Ofuscação, Potência e Presença. O grupo está em `discipline_choices`, no cadastro do clã. Os clãs tradicionais mantêm `disciplines`. O servidor recusa um dom fora das escolhas permitidas. Clã personalizado tem aviso e confirmação antes da seleção, nome livre e três dons existentes no livro; depende da avaliação do narrador.

As etapas de atributos e habilidades sugerem caminhos conforme o clã e explicam o significado dos pontos. Um toque num aumento indisponível mostra o limite inicial ou o custo em falta, sem gastar nada. Aparência Nosferatu fica em 0 e não recebe bônus/XP nas novas criações guiadas. A fraqueza tem um espaço narrativo opcional, `clan_flaw_detail`. As fichas aprovadas antes da atualização não são recalculadas. As demais fraquezas são acompanhadas pelo narrador conforme a cena, sem relógio automático nem conversão presumida de dificuldade.

Foto/enquadramento, história e convicções aparecem já na identidade. O ajudante de história junta quatro respostas num rascunho editável; não usa IA. Os exemplos de convicções podem ser acrescentados e reescritos. `moral_principle` é único por campanha, escolhido em conjunto e registrado pelo narrador; `moralityes` guarda as regras pessoais do personagem. Não há desconto automático de Humanidade.

Qualidades e defeitos ficam em abas e cores distintas, com preço de PB, efeito consultável e até seis opções por página. São opcionais. Escolhidos podem ser retirados pelos chips, e a reserva aparece na barra inferior junto de Continuar. Restrições de clã ficam identificadas antes da compra; outros requisitos aparecem no efeito e na revisão. A barra não altera o percurso obrigatório nem permite enviar com sobra.

O rascunho existe somente na memória da aba enquanto ela estiver aberta, sem localStorage ou IndexedDB. O envio completo é salvo na API, e passa a aparecer em **Personagens em avaliação**. Apagar um envio aprovado não remove a ficha já criada.

A configuração recebe `clan_guide_version: 1` para acrescentar Caitiff uma vez às campanhas anteriores; descrições do narrador, limites e listas existentes são mantidos. `guide` em cada clã permite personalizar os textos no JSON avançado. Os retratos são arquivos WebP do projeto.
