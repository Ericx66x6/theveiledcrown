# Criação guiada · 9.2

O acesso de jogador usa **Meus personagens → Criar personagem**. O narrador continua podendo transcrever fichas manualmente e ajustar propostas antes da aprovação. **Testar como jogador** também permite experimentar o assistente, sem gravar na campanha real.

## Pontos

| Reserva | Distribuição | Limite inicial |
| --- | --- | --- |
| Atributos | Todos em 1, mais 15 pontos | 4 |
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

Na segunda distribuição, o limite é 5, sujeito às restrições das características. Até quatro defeitos concedem seu valor em bônus. Qualidades consomem seu preço; não se usa XP. Versões do mesmo defeito/qualidade não são somadas quando compartilham `mutually_exclusive_group`. Retirar um defeito devolve seus pontos à contagem e pode exigir reduzir compras. Bônus restantes aparecem na confirmação e são encerrados com a criação, sem conversão para XP.

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

Cada proposta guarda `character.creation` com as duas distribuições, escolhas de clã, linhas e características. O servidor reconstrói os valores; dinheiro, XP, geração ou pontos finais enviados pelo cliente não são aceitos como cálculo confiável. O narrador recebe o relatório e a notificação, pode pedir ajustes, editar e aprovar. Exceções que alterem o resultado calculado exigem confirmação e justificativa.

O clã personalizado exige nome e três disciplinas. A aprovação do narrador permanece obrigatória, inclusive quando a contagem está correta. As listas dos clãs seguem as combinações fornecidas por Eric, sem substituir por outra edição do jogo.

Fichas já aprovadas continuam com os saldos e gerações atuais. Propostas anteriores ao assistente permanecem disponíveis para análise manual; não se tenta reconstruir uma distribuição inexistente. A validação de novas regras não aplica retroativamente capital ou efeitos de criação nas fichas antigas.

No livro, **Consultar → Visualizar** abre conteúdo completo sem edição. **Gerenciar livro → Regras e criação de fichas** permite alterar as reservas e custos. `character_creation.guided` guarda os demais parâmetros em JSON. O modelo do projeto atende instalações novas; em campanhas existentes, importe o game-data atualizado após fazer backup, seguindo **ATUALIZAR.md**.

Referência de antecedentes: https://vampiros-a-mascara.forumeiros.com/t99-antecedentes. Valores e efeitos da criação foram adaptados às regras da mesa, sem reintroduzir pontos de sangue ou dificuldade por face do dado.
