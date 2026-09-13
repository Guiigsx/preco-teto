# Stock Teto

Aplicacao web para analisar precos de referencia de acoes brasileiras e FIIs com dados publicos.

## Funcionalidades

- Busca por ticker ou nome da empresa.
- Ranking de acoes por margem de seguranca.
- Filtro visual por setor.
- Analise de acoes por Bazin, Graham, Gordon e preco medio com margem.
- Analise de FIIs por renda normalizada, VPA, P/VP, valor de referencia, desconto estimado e nota de qualidade.
- Atualizacao automatica dos ativos salvos no navegador.

## Rodar localmente

```bash
npm install
npm start
```

Depois acesse:

```text
http://localhost:3000
```

## Testes

```bash
node --test tests/fair-prices.test.js
```

## Observacao

Os calculos sao modelos quantitativos para triagem e nao recomendacao de investimento. As premissas mais sensiveis sao taxa de retorno exigida, dividendo normalizado, VPA e qualidade dos dados publicos.
