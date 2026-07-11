# Zwipe 🔥

Compra e venda com swipe: ninguém precisa procurar nada. Quem vende anuncia (categoria + região),
quem quer comprar cadastra o que procura (categoria + região), e o Zwipe cruza os dois
automaticamente — só aparece pro comprador o que bate com o que ele cadastrou. Quando os dois
lados topam (comprador curte, vendedor aceita) o Zwipe libera o contato no WhatsApp para fechar o
negócio.

Este é um projeto **independente**, dentro do repositório `agrolex-ia` apenas por conveniência de
ambiente — não compartilha código, banco de dados nem contas de usuário com o AgroLex IA.

## Rodando localmente

```bash
cd zwipe
npm install
```

### 1. Criar um projeto Supabase (separado do AgroLex)

1. Acesse [supabase.com](https://supabase.com/) e crie um novo projeto.
2. Em **Settings > API**, copie a **Project URL** e a **anon key**.
3. Em **SQL Editor > New Query**, rode os arquivos de `supabase/migrations/` **em ordem**:
   - `00000_init.sql` cria as tabelas (`profiles`, `listings`, `swipes`, `matches`), as policies de
     RLS e o bucket público `listing-photos` para as fotos dos anúncios.
   - `00001_buy_intents.sql` cria a tabela `buy_intents`, onde o comprador cadastra o que procura
     (categoria + região) para o cruzamento automático com os anúncios.

### 2. Configurar as variáveis de ambiente

Crie um arquivo `.env.local` dentro de `zwipe/`:

```text
NEXT_PUBLIC_SUPABASE_URL=cole-sua-url-do-supabase-aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole-sua-chave-anon-aqui
```

### 3. Rodar

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

> **Nota:** `npm run build` (build de produção) precisa das variáveis de ambiente acima
> configuradas — sem elas, o build falha ao tentar pré-renderizar as páginas de login/cadastro
> (o mesmo acontece com o app AgroLex na raiz do repositório). Em produção (Vercel etc.) configure
> as variáveis no painel do projeto.

## Como funciona

- **Comprar**: cadastre o que você procura (categoria + cidade/estado). O Zwipe mostra só os
  anúncios que batem com isso, em formato de swipe — direita = curtiu, esquerda = passou. Sem busca
  manual: se não bateu com nenhuma das suas buscas cadastradas, não aparece.
- **Meus Anúncios**: cadastra o que você quer vender (título, descrição, categoria, preço, cidade,
  fotos) e acompanha quem curtiu cada anúncio.
- **Ver Interessados**: para cada anúncio seu, você vê — no mesmo formato de swipe — quem curtiu, e
  decide se aceita ou recusa negociar com aquela pessoa.
- **Matches**: quando os dois lados topam, o anúncio aparece aqui com um botão para chamar a outra
  pessoa direto no WhatsApp.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase (Auth, Postgres, Storage) +
framer-motion (swipe do card-stack) + lucide-react.
