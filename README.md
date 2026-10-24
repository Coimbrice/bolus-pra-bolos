# bolus-pra-bolos

**Português** · [English](README.en.md)

[![CI](https://github.com/Coimbrice/bolus-pra-bolos/actions/workflows/ci.yml/badge.svg)](https://github.com/Coimbrice/bolus-pra-bolos/actions/workflows/ci.yml)

Biblioteca em TypeScript para calcular bolus de insulina, baseada no método do livro _Think Like a Pancreas_, de Gary Scheiner.

> [!WARNING]
> **Isto não é um dispositivo médico e não deve ser usado para decidir tratamentos.** É um exercício de programação, sem aprovação de agência reguladora, sem validação clínica e sem nenhuma garantia (veja a [LICENSE](LICENSE)). Erros de dose de insulina podem causar hipo ou hiperglicemia graves. Siga sempre a orientação da sua equipe médica. Quem construir algo em cima deste código é responsável pela segurança e pela regulação no próprio país.
>
> **This is not a medical device and must not be used to make treatment decisions.** It is a programming exercise, not approved by any regulatory agency, not clinically validated and provided without warranty. Insulin dosing errors can cause severe hypoglycemia or hyperglycemia. Always follow the guidance of your diabetes care team.

## Por quê

Fui diagnosticado com diabetes tipo 1 em agosto de 2025. Aprendendo a conviver com o diabetes, conheci a contagem de carboidratos e as contas por trás das doses de insulina, principalmente pelo _Think Like a Pancreas_. Eu sabia fazer as contas, mas sempre usei aplicativos, e fiquei curioso para ver como seria escrever meu próprio programa, mesmo já existindo vários.

## Como funciona

A fórmula do capítulo 7 do livro:

```
bolus = (dose da comida + correção − insulina ativa) × fator de atividade
```

- **Dose da comida**: carboidratos ÷ relação insulina/carboidrato.
- **Correção**: (glicemia atual − alvo) ÷ fator de sensibilidade. Fica negativa abaixo do alvo e diminui a dose.
- **Insulina ativa (IOB)**: o que ainda resta dos bolus anteriores, com a curva linear do livro ou a exponencial usada pelo Loop e pelo OpenAPS.
- **Fator de atividade**: menor que 1 para exercício, maior que 1 para longos períodos parado.

Relação, sensibilidade e alvo podem mudar ao longo do dia. A dose é arredondada para baixo no passo da caneta e pode ter um limite máximo.

**Comer de novo pouco depois de uma refeição.** Almoço de 60 g com relação 1:10 e 6 U. Uma hora depois, 30 g de sobremesa. Ainda há 4,5 U ativas, e subtraindo tudo a sobremesa ficaria sem insulina. Mas uns 40 g do almoço ainda estão sendo absorvidos e precisam de 4 U dessa insulina, então só 0,5 U está sobrando e o bolus certo é 2,5 U. Essa é a estratégia padrão, `carb-aware`. As abordagens do próprio livro também estão disponíveis: `subtract-from-total` e `correction-only`.

**Quando aplicar.** Informando a velocidade de digestão (`digestion`), o resultado sugere quando aplicar: 20 a 30 minutos antes para comida rápida (pão, arroz, batata), 5 a 10 minutos antes para moderada, e na hora para lenta, com a dose dividida em duas metades, a segunda de 1 a 2 horas depois. A glicemia adianta ou atrasa essa janela.

## Limitações

- A absorção dos carboidratos é tratada como constante. Gordura, proteína, fibra e índice glicêmico mudam isso, e gordura e proteína não entram na conta.
- A curva da insulina é fixa, mas na prática varia com a dose, o local da aplicação, a temperatura e o exercício.
- Os horários de aplicação e a divisão meio a meio são uma interpretação minha das orientações do livro, que são qualitativas.
- O resultado depende do histórico informado: uma dose ou refeição faltando gera uma resposta errada sem nenhum aviso.

## Uso

```sh
npm install github:Coimbrice/bolus-pra-bolos
```

```ts
import { calculateBolus } from 'bolus-pra-bolos';

const result = calculateBolus({
  settings: {
    unit: 'mg/dL',
    carbRatio: [
      { start: '06:00', value: 8 },
      { start: '11:00', value: 12 },
      { start: '17:00', value: 10 },
    ],
    sensitivity: 50,
    target: 100,
    insulinModel: { type: 'linear', durationHours: 4 },
    doseStep: 0.5,
    maxBolus: 15,
  },
  carbs: 30,
  glucose: 140,
  digestion: 'moderate',
  doses: [{ time: new Date('2026-10-22T12:00'), units: 6 }],
  meals: [{ time: new Date('2026-10-22T12:00'), carbs: 60 }],
  now: new Date('2026-10-22T13:00'),
});

result.units; // 2 (2,13 arredondado para baixo no passo de 0,5 U)
result.timing; // { fromMinutes: -10, toMinutes: -5 }
result.split; // null, só refeições lentas são divididas
```

Também há funções do capítulo de contagem de carboidratos (`netCarbs`, `carbsFromWeight`) e as regras de estimativa inicial do livro (`carbRatioFromTotalDailyDose`, `sensitivityFromTotalDailyDose`, `carbRatioFromWeight`). Entrada inválida lança `BolusInputError`.

O [`examples/dessert.js`](examples/dessert.js) compara as três estratégias no caso da sobremesa: `npm run example`.

## Desenvolvimento

```sh
npm install
npm test
npm run lint
npm run typecheck
```

## Como foi feito

Este projeto foi feito com a ajuda do Claude, assistente de IA da Anthropic. A ideia, o escopo e as decisões de design são meus, a partir do que aprendi com o livro e convivendo com o diabetes. O Claude ajudou a escrever o código, os testes e a documentação, e eu revisei tudo.

## Referências

- Gary Scheiner, _Think Like a Pancreas_, edição de 2012: capítulos 4 (contagem de carboidratos) e 7 (cálculo do bolus).
- [LoopKit/Loop#388](https://github.com/LoopKit/Loop/issues/388): a curva exponencial de ação da insulina.

## Licença

[MIT](LICENSE)
