# 🤖 Bot de Arbitragem de Criptomoedas

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PNPM](https://img.shields.io/badge/Package%20Manager-PNPM-blue?logo=pnpm)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

Um **bot de alta performance** que **busca**, **valida** e **exibe** oportunidades de lucro (arbitragem) entre múltiplas exchanges de criptomoedas. Construído em **TypeScript**, com **API** e **dashboard web**, permitindo acompanhar resultados em tempo real.

> 💡 **Arquitetura Modular:** Novas exchanges podem ser adicionadas facilmente através do **Adapter Pattern**, sem impactar a lógica existente.

---

## 🔎 O que o Bot Faz Atualmente

A arbitragem consiste em **comprar uma criptomoeda mais barata em uma exchange e vendê-la mais cara em outra**, aproveitando a diferença de preço.

Este bot automatiza a **análise e validação de oportunidades de arbitragem** e permite a **visualização das oportunidades em um dashboard web**.

- ✅ **Monitoramento** de preços em múltiplas exchanges (Binance, KuCoin, Bybit, etc.)
- 🧠 **Comparação** de preços para identificar oportunidades lucrativas
- 🛠️ **Validação** de oportunidades verificando carteiras e compatibilidade de redes (blockchains)
- 📊 **Exibição** de resultados em dashboard web e armazenamento no banco de dados local
> ⚠️ Importante: No momento, não há execução automática de ordens. O bot apenas encontra, valida e mostra oportunidades.
---

https://github.com/user-attachments/assets/f3eb655f-0d16-4b1b-8e95-3b44ef7c7b71

https://github.com/user-attachments/assets/eed77b71-2066-4157-aa96-f327c7e9728b

## 🏛️ Estrutura do Projeto

Organizado em **camadas separadas por responsabilidade**, garantindo manutenção e escalabilidade:

```
arbitrage/
├── db/                        # Banco de dados local
├── public/                    # Frontend dashboard (MVVM)
├── src/
│   ├── adapter/               # Conectores para cada exchange (Adapter Pattern)
│   ├── controller/            # API Layer
│   ├── facade/                # Ponto de entrada simplificado (Facade Pattern)
│   ├── repository/            # Persistência de dados (Repository Pattern)
│   ├── service/               # Lógica de negócio
│   ├── model/                 # Modelos de dados
│   ├── lib/                   # Utilitários e helpers
│   ├── types/                 # Tipos e interfaces TypeScript
│   ├── app.ts                 # Inicialização do bot
│   └── server.ts              # Inicialização da API e dashboard
├── .env                       # Chaves privadas (NÃO COMPARTILHE)
├── .env.example               # Modelo de variáveis de ambiente
├── package.json
└── tsconfig.json
```

---

## 🚀 Instalação Rápida

**Pré-requisitos:**

- Node.js (v18+)
- PNPM

**1️⃣ Clone e Instale Dependências**

```bash
git clone https://github.com/jefter-dev/arbitrage.git
cd arbitrage
pnpm install
```

**2️⃣ Configure suas Chaves de API**

Para Linux/macOS:

```bash
cp .env.example .env
```

Para Windows:

```bash
copy .env.example .env
```

> ⚠️ **Segurança:** Nunca compartilhe o arquivo `.env`. Ele já está no `.gitignore`.

---

## ⚡ Exemplo de Uso

**Rodando o Bot de Busca:**

```bash
pnpm start
```

> Armazena oportunidades no `db/db.json`.

**Iniciando o Dashboard e API:**

```bash
pnpm start:api
```

Acesse em: **[http://localhost:8000](http://localhost:8000)**

## ⚡ Endpoints da API

O bot disponibiliza os seguintes endpoints para consulta das oportunidades de arbitragem:

| Método | Rota                            | Descrição                                                                  |
| ------ | ------------------------------- | -------------------------------------------------------------------------- |
| GET    | `/api/opportunities`            | Retorna **todas as oportunidades** armazenadas no banco.                   |
| GET    | `/api/opportunities/executable` | Retorna apenas as oportunidades que são **executáveis imediatamente**.     |
| GET    | `/api/opportunities/potential`  | Retorna oportunidades **potenciais**, validadas mas não executáveis ainda. |

---

## 🛠️ Tecnologias

- **Backend:** Node.js, TypeScript, Express.js
- **Banco de Dados:** lowdb (JSON file database)
- **Frontend:** HTML, Tailwind CSS, JavaScript (MVVM Pattern)
- **Ferramentas:** Axios, PNPM, ts-node

---

## 🙌 Contribuição

Contribuições são **sempre bem-vindas**!
Você pode ajudar a:

- Adicionar novas exchanges
- Melhorar a lógica de validação
- Otimizar dashboard e performance
- Implementar novas funcionalidades

1. Fork este repositório
2. Crie uma branch com sua feature (`git checkout -b feature/nova-exchange`)
3. Faça commit das alterações (`git commit -m "feat: adicionar nova exchange"`)
4. Envie para o seu fork (`git push origin feature/nova-exchange`)
5. Abra um Pull Request 🚀

> 💡 Use issues para discutir ideias antes de implementar funcionalidades complexas.

---

## 🗺️ Próximos Passos

- Integração com WebSockets para preços em tempo real
- Execução automática de ordens
- Melhoramento na lógica de validação dos contratos
- Filtros e ordenação no dashboard
- Histórico completo de oportunidades
- Containerização com Docker

---

## 📄 Licença

Distribuído sob a licença **MIT**.

---

## 📬 Contato

Para dúvidas ou sugestões, abra uma **issue** ou entre em contato com o autor do projeto.

- **Nome:** Jéfter Lucas - JEFTER DEV
- **Email:** [contato@jefterdev.com](mailto:contato@jefterdev.com)
- **GitHub:** [https://github.com/jefter-dev](https://github.com/jefter-dev)
- **Site:** [https://jefterdev.com](https://jefterdev.com)





