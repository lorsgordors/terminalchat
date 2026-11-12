# Chat Terminal com GPT-4.1

Chat em terminal com servidor Node.js, cliente Python e respostas automáticas da OpenAI. As últimas 100 mensagens ficam em memória enquanto o servidor estiver ligado.

## Configurar a chave da OpenAI

1. Abra `chat-terminal/.env`.
2. Cole a chave após o `=`:

```env
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-4.1
```

O `.env` é lido localmente pelo servidor e não deve ser enviado ao Git. Em produção (Render), cadastre as mesmas variáveis em **Environment Variables**, pois o arquivo `.env` não deve ser publicado.

## Como a IA funciona

- Cada mensagem enviada por uma pessoa recebe uma resposta do GPT-4.1.
- Mensagens de entrada e saída não acionam a IA.
- O assistente considera até 24 mensagens recentes para manter o contexto.
- Respostas da IA ficam identificadas como `[Assistente]` e não geram um ciclo de respostas.

## Executar localmente

No diretório `chat-terminal`:

```powershell
npm start
```

Para testar o cliente local, ajuste temporariamente `URL_BASE` em `cliente.py` para `http://localhost:8080` e execute:

```powershell
py cliente.py
```

## Deploy no Render

Use `npm start` como comando de inicialização. Em **Environment Variables**, adicione `OPENAI_API_KEY` e, opcionalmente, `OPENAI_MODEL=gpt-4.1`. Não publique a chave no repositório.

O cliente continua apontando para `https://terminalchat-b1g4.onrender.com/`. Atualize `URL_BASE` caso a URL do seu serviço seja diferente.
