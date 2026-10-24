# Vercel Nuke

[English](README.md) · [Português](README.pt-BR.md)

[![Licença: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Deploy: Vercel](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)](https://vercel-nuke.vercel.app)
[![Sem backend](https://img.shields.io/badge/backend-nenhum-informational)](#seguranca-e-privacidade)
[![Roda no navegador](https://img.shields.io/badge/roda%20no-navegador-success)](https://vercel-nuke.vercel.app)
[![i18n: PT | EN](https://img.shields.io/badge/i18n-PT%20%7C%20EN-orange)](#)
[![Um arquivo HTML](https://img.shields.io/badge/um-arquivo%20HTML-lightgrey)](index.html)
[![Estrelas no GitHub](https://img.shields.io/github/stars/lenderson00/vercel-nuke?style=social)](https://github.com/lenderson00/vercel-nuke/stargazers)

Zere uma conta ou time da Vercel direto do navegador. Lista tudo que você tem e apaga só o que você escolher.

![Vercel Nuke](docs/og.png)

## Demo ao vivo

https://vercel-nuke.vercel.app

Use seu próprio token da Vercel. Nada fica guardado em nenhum servidor.

## Galeria

| | |
| --- | --- |
| ![Início](docs/desktop-en.png) | ![Início escuro](docs/desktop-dark.png) |
| ![Inventário](docs/inventory-en.png) | ![Confirmação](docs/confirm-en.png) |
| ![Inventário mobile](docs/mobile-inventory-en.png) | ![Cartão social](docs/og.png) |

## Recursos

- Apaga o que se acumula numa conta da Vercel: projetos, deployments, domínios, aliases, variáveis de ambiente, webhooks, Edge Config, integrações e Blob stores.
- Funciona na sua conta pessoal ou em qualquer time que você participa. Você escolhe o escopo antes de listar qualquer coisa.
- Filtros inteligentes por categoria, por exemplo deployments cancelados ou com erro, deployments com mais de 7 ou 30 dias, tudo exceto a produção atual, domínios não verificados e aliases de preview.
- Carregamento progressivo. Cada categoria aparece conforme é listada, então você vê resultados enquanto a varredura ainda roda.
- Gaveta de detalhes. Clique em qualquer item para ver slug, id, datas e outros metadados antes de decidir.
- Confirmação por digitação. Você redigita o nome da conta ou do time antes de apagar, então nada dispara por acidente.
- Consciente de limite de requisições. Um 429 é repetido até cinco vezes, respeitando o cabeçalho `Retry-After`.
- Ordem de exclusão segura. Recursos dependentes vão primeiro e categorias arriscadas começam desmarcadas (veja Ressalvas).

## Segurança e privacidade

- Sem backend. A página é um único arquivo HTML estático. Não existe servidor coletando nada.
- Seu token fica só no `localStorage`, no seu navegador. O botão "Esquecer token" remove ele.
- As chamadas saem do seu navegador direto para `https://api.vercel.com`. Nada passa por intermediário.
- Uma Content Security Policy estrita trava o `connect-src` apenas em `https://api.vercel.com`, então a página não consegue falar com nenhum outro host.
- Use um token de curta duração. Crie um token de 1 hora para ele expirar sozinho depois do uso.

## Como usar

1. Crie um token de acesso em https://vercel.com/account/settings/tokens com validade de 1 hora.
2. Abra o app e cole o token para conectar.
3. Escolha o escopo: sua conta pessoal ou um time específico.
4. Revise o inventário. Filtre e selecione exatamente o que quer apagar.
5. Redigite o nome da conta ou do time para confirmar e apague.

Ao terminar, apague o token nas configurações da Vercel ou clique em "Esquecer token".

## Ressalvas

- Apagar uma integração (por exemplo Neon) pode apagar também o banco de dados ligado a ela. Por isso integrações começam desmarcadas.
- Entre os produtos de storage, só os Blob stores podem ser apagados pela API. Os outros ficam intactos.
- Apagar um projeto já remove os deployments dele, então quase nunca é preciso selecionar deployments à parte.
- Isso não tem volta. Não existe desfazer do lado da Vercel depois que um recurso é apagado.

## Rodar localmente

É um arquivo só, então dá para abrir direto:

```bash
open index.html
```

Ou sirva por http, se preferir:

```bash
npx serve .
```

## Testes

Os testes rodam num navegador headless contra o HTML real, com uma API da Vercel simulada.

```bash
cd test
npm install
npm test
```

## Hospedar na Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lenderson00/vercel-nuke)

O repo já traz o `vercel.json` com os cabeçalhos de segurança e a CSP, então um clone sobe com a mesma proteção do site ao vivo.

## Endpoints da API

Toda chamada vai para `https://api.vercel.com`. Estes são os endpoints que o app usa:

| Categoria | Método | Endpoint |
| --- | --- | --- |
| Conta | GET | `/v2/user`, `/v2/teams` |
| Projetos | GET, DELETE | `/v10/projects`, `/v9/projects/{id}` |
| Deployments | GET, DELETE | `/v6/deployments`, `/v13/deployments/{id}` |
| Domínios | GET, DELETE | `/v5/domains`, `/v6/domains/{name}` |
| Aliases | GET, DELETE | `/v4/aliases`, `/v2/aliases/{id}` |
| Variáveis de ambiente | GET, DELETE | `/v9/projects/{id}/env`, `/v1/env` |
| Webhooks | GET, DELETE | `/v1/webhooks`, `/v1/webhooks/{id}` |
| Edge Config | GET, DELETE | `/v1/edge-config`, `/v1/edge-config/{id}` |
| Integrações | GET, DELETE | `/v1/integrations/configurations`, `/v1/integrations/configuration/{id}` |
| Storage (Blob) | GET, DELETE | `/v1/storage/stores` |

A exclusão roda em ordem de categoria: integrações, Edge Config, webhooks, variáveis de ambiente, aliases, deployments, projetos, domínios, storage.

## Licença

MIT. Veja [LICENSE](LICENSE).

## Aviso

Sem vínculo com a Vercel. Usa a API pública da Vercel com um token que você fornece. Você é responsável pelo que apagar.
