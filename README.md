# VITORIA SPOT

Site estático pronto para publicação no GitHub Pages.

## Estrutura

- `index.html`: estrutura da página (HTML).
- `style.css`: todos os estilos (CSS).
- `script.js`: toda a lógica do dashboard (JavaScript).

Os três arquivos precisam ficar na mesma pasta.

## Como usar

- Abra `index.html` para acessar a tela inicial.
- A página inicial direciona para `original/index.html` e `dashboard/index.html`.
- O projeto usa HTML, CSS e JavaScript; não há código Java neste pacote.

## Publicar no GitHub Pages

1. Extraia este ZIP.
2. Envie o conteúdo da pasta `vitoria-spot-site` para um repositório.
3. Nas configurações do repositório, ative o GitHub Pages usando a branch principal e a pasta raiz.

## Situação: dropdown e integração com o dashboard

A lista suspensa da planilha é gerada a partir das mesmas 13 opções coloridas do dashboard. O importador reconhece cabeçalhos iniciados por `Situação`, `Situation`, `Status` ou `Fila` (por exemplo, `Situação (lista clicável)` e `Fila atual`). Se houver mais de uma dessas colunas, prioriza `Situação`/`Status` em vez de `Fila`. Depois de editar a planilha no Excel/OneDrive, importe o arquivo no dashboard por **Anexar planilha de retorno** e confirme com **OK**; não há sincronização automática do OneDrive para o dashboard.

## Aba Análise Base (corrigida)

A aba estava em branco porque o `index.html` não tinha a lógica nem o CSS dessa aba (ela existia só no `script.js`, que a página não carrega). Agora a lógica está no `script.js` e o CSS no `style.css`: filtro por regional e base, calendário De/Até, atalhos de 3/6/12 meses, resumo por mês e, ao clicar no mês, o valor de cada dia. Os dados vêm das planilhas já importadas (arquivos antigos salvos no navegador).

## Regra de Valor Revertido

A configuração oficial do prazo fica no JavaScript do dashboard (`script.js`): na aba **Valor Revertido**, o valor é calculado pacote a pacote: pacote que desaparece até 48 horas entra como **Valor revertido**; pacote que continua presente após 48 horas entra como **Valor não revertido/ofensor**. O **Valor atual** mostra o total real atual. A aba **Pacote Revertido** usa a mesma regra própria de 48 horas.

## Pacotes em Rota também no LOST

Ao anexar uma planilha de **Pacotes em Rota** no painel LOST, ela continua salva e visível na aba **Pacotes em Rota**. Se ainda não existir uma planilha LOST para aquele dia, o dashboard cria automaticamente uma importação provisória com os mesmos pacotes para que ela apareça em **LOST > Todos**. Quando a planilha LOST real for anexada depois, ela substitui a importação provisória do dia. Arquivos cujo nome contém um intervalo de datas, como `2026-10-01_2026-10-31`, não alteram indevidamente o dia do arquivo: nesse caso, o dia selecionado no formulário (ou o dia atual) é usado.

Os campos de planilha de Pacotes em Rota e de LOST/Risco LM aceitam vários arquivos de uma só vez. Cada arquivo é lido e salvo separadamente, respeitando o dia e o turno identificados no nome ou informados no formulário.

No DASH LOST, o primeiro cartão em **Importados** é **LOST · 1) Pacotes perdidos** e reconhece automaticamente tanto o formato LOST/Risco LM quanto o formato Pacotes em Rota. Assim, quando o LOST do dia ainda não estiver disponível, basta anexar a planilha de Pacotes em Rota nesse mesmo cartão.

## Valor Revertido: Ofensores da manhã

O antigo bloco "Selecionar bases / Escolha as regionais" foi removido. No lugar, a aba **Valor Revertido** tem **Ofensores da manhã**:

1. De manhã, com a planilha da manhã aberta, digite o valor (ex.: 10.000) e clique **Classificar como ofensores**. As bases com valor igual ou acima ficam guardadas para aquele dia.
2. À tarde, não digite nada: clique em **Puxar ofensores da manhã (valor atual)**. A tela mostra essas bases com o valor atual de cada uma. Clique de novo (**Voltar para todas as bases**) para sair do filtro.
3. **Limpar lista** apaga a lista do dia. A câmera captura só o nome das bases guardadas.

O bloco permanece na tela **Valor Revertido** do DASH LOST. Ao classificar, o sistema usa a planilha da data selecionada; se essa data não estiver disponível, usa a planilha ativa ou a importação mais recente, evitando o erro de “Não há planilha importada nesta data”.

## Ofensores por regionais: ocultar, confirmar e analisar

Na tela **Ofensores por Regionais**, use **Ocultar** na base que não deve participar da seleção. As bases ocultadas ficam guardadas no navegador e podem ser restauradas em **Bases ocultadas** com **Mostrar novamente**. Depois de ajustar os filtros e ocultar o que não deseja, clique em **Confirmar ofensores**: a lista confirmada contém as bases ainda visíveis. A confirmação também é salva no navegador; **Editar seleção** reabre a escolha.

Na lista confirmada, clique em uma base para ver o gráfico com o valor diário por semana. O botão **INFO PACOTES** ao lado do título abre os detalhes dos pacotes da base. Os indicadores mostram **Começo da semana** (primeiro dia com planilha), **Menor valor** e **Valor atual**, todos acompanhados da data. As faixas são: até R$ 1.000 (verde/tranquilo), acima de R$ 1.000 até R$ 5.000 (amarelo), acima de R$ 5.000 e abaixo de R$ 10.000 (laranja) e R$ 10.000 ou mais (vermelho). Dias sem planilha ficam sem marcador, a linha conecta os pontos importados e os valores diários não são somados entre si. Na semana atual, o período termina na data de hoje.

## Meta semanal (igual em Regional e Base e em Valor Revertido)

As duas abas calculam a meta sobre o valor da **primeira planilha da semana** (segunda-feira) ou, se a meta foi ativada no meio da semana, da primeira planilha a partir do dia da ativação. Na coluna **Meta da semana** do Valor Revertido aparecem: valor no início da semana, meta (quanto reduzir), quanto já reduziu e quanto falta. Pacotes que entraram há menos de 24h não contam na meta.

Quando uma base não existe na primeira planilha da semana, ela começa com base zero e passa a ter sua própria base de cálculo na primeira planilha em que aparece com valor. Na captura do Valor Revertido, a câmera e o botão **Copiar print** mostram somente os nomes das bases exibidas pelo filtro de situação e regional selecionados, sem aplicar o filtro de valor mínimo.

## REPORT LOST: reconhecimento de XPT

A planilha REPORT LOST (`report_lost_on_route_*.csv`) é a única necessária para Pacotes em Rota / LOST. Ela não tem coluna "XPT": a base XPT vem em **Centro de destino** (códigos iniciados por `E`, ex.: EMG40, ERJ2). Regra aplicada na importação:

- Centro de destino com código `E...` → o pacote entra na **base XPT** (tipo XPT); o SVC de origem continua no campo Origem (ex.: SMG3 → EMG40: "EMG40 XPT de SMG3").
- Destino vazio, `BRN...` ou `BRD...` → o pacote fica na **base SVC** de origem.
- Bahia e São Paulo não têm XPT e ficam sempre em SVC.
- Dados já salvos no navegador antes desta regra são corrigidos automaticamente ao abrir o dash.

A tabela SVC ↔ XPT usada nos rótulos ("SVC de ...") vem da planilha BSC Delivery Success (`SVC_TO_XPT` no `script.js`). Se surgir um XPT novo, basta incluir a linha nessa tabela.

A coluna **Produto** não existe no REPORT LOST; ela só é preenchida quando o mesmo pacote já foi importado em outra planilha que traga o item (SHP_ITEM_DESC).


## Planilhas necessárias
- **REPORT LOST** (`report_lost_on_route_*.csv`): obrigatório e suficiente para o Análise Lost/Pacotes em rota.
- **REPORT DRIVER** (`report_driver_*.xlsx`): opcional; serve apenas para trocar o ID do transportador pelo nome do motorista. O arquivo enviado contém somente a lista de IDs, então não acrescenta nomes.
- **Planilha de retorno**: opcional; só é necessária para registrar situação, justificativa ou foto.

## Distribuição SVC/XPT
No REPORT LOST, se `Centro de destino` começar com `E` (por exemplo `EMG40`, `ERJ2`, `EES8`), o pacote é contado na base de destino como **XPT**. Se o destino estiver vazio ou for `BRN/BRD`, o pacote permanece na base `Centro de origem` como **SVC**.

## Ocultar bases (Valor Revertido e Ofensores por Regional)

Cada linha do **Valor Revertido** tem o botão **Ocultar** (a base sai da tabela, dos totais e do print). Acima da tabela aparece **Mostrar bases ocultas (N)** com a lista e os botões **Mostrar novamente** / **Mostrar todas**. O mesmo painel aparece no topo de **Ofensores por Regional**. As bases ocultas ficam salvas no navegador (separadas para cada aba).

## Importação da planilha LOST

O nome do arquivo reconhece data e turno automaticamente, por exemplo `report_lost_on_route_472463006_19.11.2026-manhã.csv` (também `19_11_2026`, `19-11-2026`, `2026-11-19`, e `manhã`/`manha`/`tarde`). Se a data for escolhida manualmente, ela tem prioridade. A leitura foi acelerada: antes cada linha varria todas as planilhas já importadas; agora usa um índice único, e a gravação acontece uma vez no fim.

## Copiar / salvar print

O print ignora botões Ocultar e o painel de ocultas, converte cores modernas que o html2canvas não entende e, se o navegador recusar copiar, salva o PNG automaticamente. Em caso de erro, a mensagem mostra o detalhe técnico.

## Análise Pré Fatura (novo painel, ao lado do Análise LOST)

Na tela inicial agora existem **dois cartões lado a lado**: `LOST` e `PRÉ FATURA`.
O cartão **PRÉ FATURA** abre `prefatura.html` (arquivos `prefatura.html`, `prefatura.css` e `prefatura.js`, que precisam ficar na mesma pasta de `style.css`).

### O que ele faz
- Lê **somente a aba `Lost pack`** de cada planilha de pré fatura (o nome do arquivo pode mudar; o reconhecimento é pelo nome da aba).
- Cada planilha é guardada em uma **quinzena** (`1ª` ou `2ª` do mês). A quinzena é detectada pelo nome do arquivo/aba (`1Q`, `2Q`, `Detalhes 1Q Outubro`, etc.) e pode ser corrigida depois na lista de planilhas importadas (select 1ª/2ª + mês/ano).
- **Duas planilhas na mesma quinzena** são somadas; a lixeira exclui uma planilha sem afetar as outras.
- Colunas usadas: `Bases`, `Tipo`, `Descrição`, `ID da rota`, `Data de Inicio`, `Placa`, `Motorista`, `Quantidade`, `Preço unitário` e `Total`. Valor = `Total` quando existir; senão `Preço unitário × Quantidade`.
- Regional vem do prefixo da base: `SES/EES/EBA` = ES, `SMG/EMG` = MG, `SBA` = BA, `SRJ/ERJ` = RJ, `SSP` = SP, `BRxx` = pela UF. Linha sem base entra como **SEM BASE** (continua somando no total).

### Telas
1. **Visão Geral** – valor total, pacotes, bases e motoristas ofensores, ticket médio, valor por quinzena, valor por regional, top 10 bases, top 10 motoristas e resumo por quinzena.
2. **Regionais e Bases** – ranking de regionais (com % do total e variação sobre o período anterior), evolução das regionais por quinzena, ranking de bases (clique em uma base para ver a evolução e os motoristas daquela base) e exportação CSV.
3. **Motoristas Ofensores** – ranking por valor, pacotes ou reincidência, filtro de valor mínimo, "somente reincidentes (2+ quinzenas)", gráfico dos 15 maiores, distribuição de reincidência, detalhe com bases, quinzenas e pacotes.
4. **Evolução no Tempo** – série por quinzena ou por mês, total ou uma linha por regional, valor ou pacotes, opção de acumulado, top bases/motoristas do período e comparativo com variação.
5. **Importar Planilhas** – anexo de uma ou várias planilhas, escolha manual de quinzena/mês, lista das planilhas salvas (com correção de quinzena e exclusão) e resumo por quinzena.

### Período
Os filtros globais (topo de todas as telas) têm **De/Até por quinzena** e atalhos **Última, 3 meses, 6 meses, 12 meses e Tudo**. Os atalhos contam a partir da última quinzena importada, então "3 meses" mostra as seis últimas quinzenas (três meses) que existirem no navegador.

### Onde ficam os dados
Tudo fica no `localStorage` do navegador (`spot_prefatura_v1`), como no dash LOST. Nada é enviado para servidor.

## Importados dentro de Configuração (dash LOST)

A aba **Importados** saiu da barra de abas do Análise LOST. Para anexar planilhas agora: **Configuração › Importados**. O restante do dash LOST não foi alterado.

## Atualizações recentes do Pré Fatura

- O upload aceita **várias planilhas ao mesmo tempo**. Com `Detectar automaticamente`, cada arquivo é lido individualmente e direcionado para sua própria quinzena conforme o nome do arquivo/aba; o resultado informa a quinzena atribuída a cada arquivo.
- No ranking de **Motoristas Ofensores**, cada linha é clicável. O detalhe mostra o nome completo da base, nome do pacote, número do pacote (inclusive os números iniciados por `4`), descrição completa, ID da rota, data e valor.
- A **Evolução no Tempo** inclui todas as quinzenas entre De e Até. De `1ª quinzena/Julho` até `1ª quinzena/Novembro`, por exemplo, entram as duas quinzenas de julho, agosto, setembro e outubro, mais a 1ª de novembro.
- O símbolo de câmera captura cada bloco e a tela ativa. A imagem é copiada para a área de transferência quando autorizado pelo navegador; não há download automático.
- Também são aceitos arquivos chamados **Desconto**. O sistema procura primeiro a aba `Lost pack`, depois `Lost` e, por fim, qualquer aba cujo nome contenha `Lost`; não é necessário usar Ctrl+A na planilha, pois todas as linhas da aba reconhecida são lidas. O upload permite selecionar vários arquivos de uma vez.
- Na tabela de motoristas, a coluna mostra a(s) **base(s) ofensora(s)**, e não a regional. Os códigos `BRN`, `BRX` e `BRD` são tratados como casos sem base operacional, aparecendo em `SEM BASE`, mas o código original continua disponível no detalhe.
- Cada pacote do detalhe tem o botão **Ver no Logistic ↗**, montado a partir do número encontrado na descrição, como `48247419487` em `PACOTE PERDIDO: UOH6I01 17/10/2026 48247419487`.
- A Evolução no Tempo abre por mês e exibe o valor sobre os pontos do gráfico. O intervalo inclui as duas quinzenas dos meses completos entre De e Até; por exemplo, de 1ª quinzena de outubro até novembro entram 1ª e 2ª de outubro e as quinzenas de novembro dentro do limite.
- O botão de câmera copia o print para a área de transferência; não baixa arquivo automaticamente.
