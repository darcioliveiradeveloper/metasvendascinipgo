# VendaCerta — Acompanhamento de Vendas

Sistema completo de acompanhamento de vendas para vendedores, supervisores e suporte.

- Vendedor lança o **total acumulado vendido no mês** (em fardos).
- O sistema calcula **tendência**, **meta diária restante** e **dias úteis** automaticamente (segunda a sexta).
- Supervisor define **metas individuais**, acompanha o **painel geral** e gera **relatórios e gráficos** mensal, trimestral, semestral e anual.
- Suporte gerencia **vendedores** (criar, editar, inativar, excluir) e acompanha todos os painéis.

## Tecnologias

- **Backend:** Node.js + Express + MongoDB (Mongoose)
- **Autenticação:** JWT em cookie httpOnly + senha com hash (bcrypt)
- **Frontend:** HTML/CSS/JS puro + Chart.js
- **Banco:** MongoDB Atlas (nuvem)
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
4. Cada vendedor entra com sua conta, lança o total acumulado do mês e acompanha
   tendência e meta diária.
5. Em **Relatórios**, o supervisor escolhe o período (mês, trimestre, semestre, ano)
   e gera gráficos e comparativos.

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
├─ public/            # frontend (HTML, CSS, JS)
│  ├─ login.html      # tela de login
│  ├─ app.html        # aplicativo (vendedor e supervisor)
│  ├─ css/style.css
│  └─ js/api.js, login.js, app.js
├─ src/
│  ├─ server.js       # entrada do servidor
│  ├─ config/db.js    # conexão com o MongoDB
│  ├─ models/         # User, MetaMensal, Lancamento
│  ├─ middleware/auth.js
│  ├─ routes/         # auth, me, supervisor, relatorios
│  └─ services/negocio.js  # cálculo de dias úteis, tendência e meta diária
├─ test/api.test.js   # testes da API
├─ .env.example
└─ package.json
```

## Regras de negócio

- **Dias úteis:** segunda a sexta (sábado e domingo não contam).
- **Dias trabalhados:** dias úteis do mês até ontem (o dia atual ainda não conta; o cálculo é feito no início do dia).
- **Dias restantes:** dias úteis de hoje até o fim do mês (inclusive hoje).
- **Tendência:** `(vendas ÷ dias trabalhados) × dias úteis do mês ÷ meta × 100`.
- **Meta diária:** `(meta − vendas) ÷ dias úteis restantes`.
- O vendedor pode trabalhar com um **mês diferente do calendário** (ex.: lançar o mês passado alguns dias depois).

## Histórico de Versões

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
