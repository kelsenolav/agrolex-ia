# AgroLex IA - Manual de Inicialização para Iniciantes 🚜⚖️

Bem-vindo ao AgroLex IA! Se você não tem experiência técnica, não se preocupe. Este manual vai te guiar passo a passo, como uma receita de bolo, para colocar o projeto no ar no seu computador.

## O que é este projeto?
É uma plataforma SaaS onde você pode enviar documentos rurais (como matrículas e CAR) em PDF, e a Inteligência Artificial analisa o documento para detectar riscos e gerar um parecer técnico automaticamente.

---

## Passo 1: Preparando o seu Computador (Instalação do Node.js)
Para rodar este projeto, seu computador precisa de um programa chamado **Node.js**.

1. Acesse o site oficial: [https://nodejs.org/](https://nodejs.org/)
2. Baixe a versão chamada **"LTS"** (Recomendada para a maioria dos usuários).
3. Abra o arquivo baixado e instale como qualquer outro programa (basta clicar em "Avançar" / "Next" até o fim).
4. Para confirmar se deu certo, procure no seu computador por um programa chamado **"Terminal"** (no Mac) ou **"Prompt de Comando (CMD)"** (no Windows).
5. Digite: `node -v` e aperte Enter. Se aparecer um número (ex: v20.x.x), está tudo certo!

---

## Passo 2: Abrindo o Projeto

1. Abra o **Terminal** ou **Prompt de Comando**.
2. Você precisa navegar até a pasta onde o projeto está salvo. 
   - Digite `cd caminho/para/a/pasta/agrolex-ia` e aperte Enter.
   - *(Dica: Você pode digitar `cd ` e arrastar a pasta do AgroLex IA para dentro da tela preta e apertar Enter).*

---

## Passo 3: Instalando as "Peças do Motor" (Dependências)

Dentro da pasta do projeto no Terminal, digite o seguinte comando e aperte Enter:
```bash
npm install
```
*O computador vai baixar todos os arquivos necessários para o projeto funcionar (isso pode levar 1 ou 2 minutos).*

---

## Passo 4: Configurando as Chaves Secretas (.env.local)

O projeto precisa de algumas "chaves" para falar com o Banco de Dados (Supabase) e com a Inteligência Artificial (OpenAI).

1. Na pasta do projeto, você verá um arquivo chamado `.env.local` (se não vir, crie um arquivo com exatamente esse nome).
2. Abra-o usando o Bloco de Notas ou qualquer editor de texto e coloque as suas senhas:

```text
NEXT_PUBLIC_SUPABASE_URL=cole-sua-url-do-supabase-aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=cole-sua-chave-anon-aqui
SUPABASE_SERVICE_ROLE_KEY=cole-sua-chave-service-aqui
OPENAI_API_KEY=cole-sua-chave-da-openai-aqui
```

### Como criar o banco de dados (Supabase)?
1. Acesse [https://supabase.com/](https://supabase.com/) e crie uma conta grátis.
2. Clique em "New Project" (Novo Projeto).
3. Após criar, vá na aba **Settings** (ícone de engrenagem) > **API**.
4. Lá você encontrará a sua **Project URL** e a **anon key**. Copie e cole no arquivo `.env.local`.
5. Vá na aba **SQL Editor** no painel esquerdo do Supabase, clique em "New Query".
6. Abra o arquivo `supabase/migrations/00000_init.sql` que está dentro do nosso projeto, copie todo o texto de dentro dele, cole no Supabase e aperte **Run** (Executar). Isso criará todas as tabelas (Perfís, Fazendas, Análises, etc).

---

## Passo 5: Ligando o Motor (Rodando o Projeto)

No Terminal (certifique-se de que ainda está dentro da pasta do projeto), digite:
```bash
npm run dev
```

Pronto! O sistema vai iniciar. 
Abra o seu navegador (Chrome, Edge, etc.) e digite:
**http://localhost:3000**

Você verá a tela principal (Landing Page) do AgroLex IA linda e funcionando!

---

## Passo 6: Publicando na Internet (Vercel)

Para que qualquer pessoa no mundo possa acessar o seu site (ex: www.agrolex.com.br):

1. Crie uma conta no [GitHub](https://github.com/) e coloque a pasta do seu projeto lá.
2. Crie uma conta grátis na [Vercel](https://vercel.com/).
3. Na Vercel, clique em "Add New Project" e conecte com a sua conta do GitHub.
4. Selecione o projeto "agrolex-ia".
5. Na parte de "Environment Variables", adicione as mesmas senhas que você colocou no arquivo `.env.local` no Passo 4.
6. Clique em **Deploy**.

Em menos de 5 minutos, a Vercel vai te dar um link para o seu site no ar! 🎉

---

## Próximos Passos (Evolução do Sistema)
A estrutura já foi criada de forma profissional para receber estas atualizações no futuro:
- **Painel Administrativo:** Ver métricas gerais e faturamento.
- **Assinaturas (SaaS):** Cobrar mensalidades usando Stripe ou MercadoPago.
- **Leitura de Imagens Escaneadas (OCR):** Melhorar a IA para ler PDFs antigos sem texto selecionável (visão computacional).
- **Integrações de Governo:** Ligar as APIs do SIGEF e SNCR.
- **WhatsApp API:** Enviar alertas no celular do produtor se houver risco alto.

Feito com 💚, Dourado e muita Inteligência Artificial!
