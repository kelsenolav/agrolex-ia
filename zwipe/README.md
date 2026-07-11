# Zwipe 🔥

Compra e venda com swipe: quem vende anuncia, quem quer comprar dá like, e quando os dois lados
topam (comprador curte, vendedor aceita) o Zwipe libera o contato no WhatsApp para fechar o negócio.

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
3. Em **SQL Editor > New Query**, cole todo o conteúdo de `supabase/migrations/00000_init.sql`
   e clique em **Run**. Isso cria as tabelas (`profiles`, `listings`, `swipes`, `matches`), as
   policies de RLS e o bucket público `listing-photos` para as fotos dos anúncios.

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

- **Comprar**: dá swipe nos anúncios ativos de outras pessoas. Direita = curtiu, esquerda = passou.
- **Meus Anúncios**: cadastra o que você quer vender (título, descrição, categoria, preço, cidade,
  fotos) e acompanha quem curtiu cada anúncio.
- **Ver Interessados**: para cada anúncio seu, você vê — no mesmo formato de swipe — quem curtiu, e
  decide se aceita ou recusa negociar com aquela pessoa.
- **Matches**: quando os dois lados topam, o anúncio aparece aqui com um botão para chamar a outra
  pessoa direto no WhatsApp.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase (Auth, Postgres, Storage) +
framer-motion (swipe do card-stack) + lucide-react.
