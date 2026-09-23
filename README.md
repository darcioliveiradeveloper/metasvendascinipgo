# VendaCerta — Acompanhamento de Vendas

Sistema completo de acompanhamento de vendas para vendedores, supervisores e suporte.

- Vendedor lança o **total acumulado vendido no mês** (em fardos).
- O sistema calcula **tendência**, **meta diária restante** e **dias úteis** automaticamente (segunda a sexta, descontando feriados).
- Feriados **nacionais** (fixos e móveis) são descontados sozinhos; feriados **municipais ou folgas** da empresa podem ser adicionados pelo supervisor/suporte pela tela 📅 Feriados.
- Modo **offline / carregamento rápido (PWA)**: o app é instalável na tela inicial do celular, guarda os dados num **banco local (IndexedDB)** e reabre instantaneamente, sincronizando com o servidor em segundo plano.
- Supervisor define **metas individuais**, acompanha o **painel geral** e gera **relatórios e gráficos** mensal, trimestral, semestral e anual.
- Suporte gerencia **vendedores** (criar, editar, inativar, excluir) e acompanha todos os painéis.

## Tecnologias

- **Backend:** Node.js + Express + MongoDB (Mongoose)
- **Autenticação:** JWT em cookie httpOnly + senha com hash (bcrypt)
- **Frontend:** HTML/CSS/JS puro + Chart.js
- **PWA:** manifest + service worker (`public/sw.js`) para instalação e funcionamento offline do shell
- **Banco local no dispositivo:** IndexedDB (`public/js/db.js`) com cache por URL; o app mostra os últimos dados instantaneamente e sincroniza com o servidor em segundo plano
- **Banco central:** MongoDB Atlas (nuvem)
- **Hospedagem:** Render

## Rodar localmente (desenvolvimento)

1. Instale o Node.js (v18 ou maior).
2. Copie o arquivo `.env.example` para `.env` e preencha:
   - `MONGO_URL` — string de conexão do MongoDB (Atlas ou local)
   - `JWT_SECRET` — chave secreta longa (troque!)
   - Dados do supervisor inicial (criado automaticamente na primeira vez que o servidor sobe)
3. Instale as dependências e rode:

```bash
npm install
npm start
```

Acesse `http://localhost:3000`.

> Para desenvolver com reinício automático: `npm run dev`.

## Testes

Os testes usam um MongoDB em memória (não precisa ter MongoDB instalado):

```bash
npm test
```

## Como usar

1. **Primeiro acesso:** o supervisor entra com o e-mail/senha definidos no `.env`
   (padrão: `supervisor@exemplo.com` / `admin123` — troque depois de entrar).
2. Na aba **Vendedores**, o supervisor cria as contas (nome, setor, e-mail, senha).
3. Na aba **Visão Geral**, o supervisor define a meta mensal de cada vendedor.
4. Se o mês tiver feriado municipal ou folga especial, o supervisor/suporte clica em **📅 Feriados**, escolhe o mês e adiciona (data + nome). Feriados nacionais já são descontados automaticamente.
5. Cada vendedor entra com sua conta, lança o total acumulado do mês e acompanha
   tendência e meta diária.
6. Em **Relatórios**, o supervisor escolhe o período (mês, trimestre, semestre, ano)
   e gera gráficos e comparativos.

## Modo offline e carregamento rápido (PWA)

O VendaCerta é uma **PWA** (Progressive Web App) e usa um **banco local (IndexedDB)** no celular:

- Na primeira abertura, o app baixa os dados e os guarda no aparelho.
- Nas aberturas seguintes, **mostra os valores imediatamente** a partir do banco local e
  sincroniza com o servidor em segundo plano — sem esperar o servidor acordar (Render free dorme após inatividade).
- **Offline:** se não houver conexão, o app avisa no topo da tela e continua mostrando os
  últimos dados salvos no dispositivo.
- **Instalar no celular:** no menu do navegador (Chrome/Edge/Safari), escolha
  "Adicionar à tela inicial" / "Instalar app". O app ganha ícone próprio e abre em tela cheia.

O cache local é **invalidado automaticamente** sempre que há uma escrita (lançar venda, alterar
meta, fechar mês, editar usuários etc.), garantindo que os dados não fiquem desatualizados.

## Deploy no Render

1. Suba este projeto para um repositório no GitHub.
2. No Render, clique em **New > Web Service** e conecte o repositório.
3. Configure:
   - **Build Command:** `npm install --omit=dev`
   - **Start Command:** `npm start`
4. Em **Environment**, adicione as variáveis:
   - `MONGO_URL` — string de conexão do MongoDB Atlas
   - `JWT_SECRET` — chave secreta longa
   - `EMAIL_SUPERVISOR_INICIAL`, `NOME_SUPERVISOR_INICIAL`, `SENHA_SUPERVISOR_INICIAL`
5. Clique em **Deploy**. Ao terminar, o Render mostra o endereço (ex.: `https://metas-de-venda.onrender.com`).

## Criar o banco no MongoDB Atlas (grátis)

1. Crie uma conta em `https://www.mongodb.com/cloud/atlas`.
2. Crie um **cluster** gratuito (M0).
3. Em **Database Access**, crie um usuário com senha forte.
4. Em **Network Access**, libere acesso de qualquer IP: `0.0.0.0/0`.
5. Clique em **Connect > Connect your application** e copie a string de conexão.
6. Cole na variável `MONGO_URL` (substitua `<password>` pela senha do usuário).

## Estrutura

```
metasvendascinipgo/
├─ public/            # frontend (HTML, CSS, JS, PWA)
│  ├─ login.html      # tela de login
│  ├─ app.html        # aplicativo (vendedor e supervisor)
│  ├─ manifest.json   # PWA (instalação)
│  ├─ sw.js           # service worker (offline do shell)
│  ├─ icons/          # ícones do app (192/512/apple-touch)
│  ├─ css/style.css
│  └─ js/db.js, api.js, login.js, app.js   # db.js = banco local (IndexedDB)
├─ src/
│  ├─ server.js       # entrada do servidor
│  ├─ config/db.js    # conexão com o MongoDB
│  ├─ models/         # User, MetaMensal, Lancamento, Feriado
│  ├─ middleware/auth.js
│  ├─ routes/         # auth, me, supervisor, relatorios
│  └─ services/       # negocio.js (dias úteis, tendência, meta diária)
│                     # dashboard.js (painéis) e feriados.js (nacionais + manuais)
├─ test/api.test.js   # testes da API
├─ .env.example
└─ package.json
```

## Regras de negócio

- **Dias úteis:** segunda a sexta, descontando feriados (sábado, domingo e feriados que caem em dia útil não contam).
- **Feriados nacionais:** calculados automaticamente — fixos (01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12) e móveis (Carnaval, Sexta-feira Santa, Páscoa e Corpus Christi, derivados da data da Páscoa).
- **Feriados manuais:** o supervisor ou suporte pode adicionar/remover feriados municipais e folgas da empresa pela tela 📅 Feriados (modelo `Feriado`, rota `/api/supervisor/feriados`).
- **Dias trabalhados:** dias úteis do mês até ontem (o dia atual ainda não conta; o cálculo é feito no início do dia).
- **Dias restantes:** dias úteis de hoje até o fim do mês (inclusive hoje).
- **Tendência:** `(vendas ÷ dias trabalhados) × dias úteis do mês ÷ meta × 100`.
- **Meta diária:** `(meta − vendas) ÷ dias úteis restantes`.
- O vendedor pode trabalhar com um **mês diferente do calendário** (ex.: lançar o mês passado alguns dias depois).

## Histórico de Versões

### v2.3.0 — Set 2026
Modo **offline e carregamento rápido (PWA)**. O app vira uma PWA instalável (manifest, ícones e service worker `sw.js`) e passa a usar um banco local **IndexedDB** (`public/js/db.js`, cache por URL): painéis, equipe, usuários, relatórios e feriados carregam os últimos dados instantaneamente e sincronizam com o servidor em segundo plano. Se o servidor estiver dormindo (cold start do Render free) ou sem conexão, o app mostra os dados salvos no celular e exibe um aviso no topo. Cache invalidado automaticamente em qualquer escrita. Login offline não é permitido (segurança); relatórios e painéis continuam disponíveis com os dados locais.

### v2.2.0 — Set 2026
Feriados no cálculo de dias úteis. Feriados nacionais (fixos e móveis: Carnaval, Sexta-feira Santa, Páscoa, Corpus Christi) descontados automaticamente em todos os painéis, histórico e relatórios (coluna D.U.). Novo modelo `Feriado` e serviço `feriados.js`. Botão 📅 Feriados na Visão Geral do supervisor/suporte: escolhe o mês, vê a lista (nacionais marcados como automáticos) e adiciona/exclui feriados municipais ou folgas especiais da empresa. Testes da API ampliados para 32 casos (Independência, feriados móveis 2026, feriado manual e CRUD de feriados).

### v2.1.1 — Ago 2026
Ícone de informações e versões ℹ️ no cabeçalho do aplicativo (todos os perfis), ao lado do botão Sair, abrindo modal com o histórico completo de versões. Removido da tela de login, que agora mostra apenas a versão.

### v2.1.0 — Ago 2026
Relatório do supervisor reformulado: filtros Ano / Período / Setor (igual ao do vendedor), com lupa e botão fechar em linha. Mês atual em aberto não entra mais nos períodos (3/6 meses). Detalhamento da equipe com Vendas%, Tend.% e M. Diária em colunas separadas e números centralizados. Diferença entre meta geral do supervisor e soma da equipe aparece entre parênteses (verde/vermelho). Suporte agora vê o painel do supervisor preenchido, sem botões de edição. Filtro por setor no backend. Títulos de tabelas e caixas escurecidos.

### v2.0.0 — Ago 2026
App renomeado para **VendaCerta**. Trocar senha simplificado. Crédito desenvolvedor no login. Inativar/excluir vendedor. Botões do header reordenados (✏️🔒🎨✕). Fundo temático. Relatório individual do vendedor. Select de ano. Botões lupa/✕. Filtro mês anterior/3 meses/6 meses/ano. Histórico 3 meses recentes.

### v1.4.0 — Jul 2026
Fechar mês disponível (após incluir). Relatório supervisor: filtrar período, gráfico barras, insights (maior/menor venda, média mensal).

### v1.3.0 — Jul 2026
Login redesenhado com gradiente. Tema com 5 cores (🎨). Nome-setor no header. Fundo suave muda com o tema.

### v1.2.0 — Jul 2026
Painel suporte: CRUD completo de vendedores. Definir metas individuais. Resetar senha. 3 abas (Usuários / Visão Geral / Relatórios).

### v1.1.0 — Jun 2026
Modo print 📷 e print limpo 🖼️. Histórico mensal com gráfico de barras. Botões incluir e fechar mês.

### v1.0.0 — Jun 2026
Lançamento inicial. Login com JWT. Painel vendedor: meta, tendência, meta diária. Painel supervisor. Cálculo automático de dias úteis (seg–sex). Testes da API.
