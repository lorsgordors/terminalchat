# Chat via terminal

Servidor HTTP em Node.js e cliente em Python 3, sem dependências externas ou
instalação com pip. As mensagens ficam apenas na memória do servidor: são
mantidas as últimas 50 e elas desaparecem quando o processo reinicia.
Após uma reinicialização, reinicie também os clientes para acompanhar os novos
IDs de mensagem.

## GitHub e Render

1. Crie um repositório no GitHub e envie os arquivos desta pasta. Por exemplo,
   após criar o repositório vazio, execute dentro de `chat-terminal`:

   ```sh
   git init
   git add package.json server.js cliente.py README.md
   git commit -m "Criar chat de terminal"
   git branch -M main
   git remote add origin https://github.com/lorsgordors/terminalchat
   git push -u origin main
   ```

2. No Render, crie um **Web Service**, conecte o repositório e selecione o
   ambiente Node. Use `npm start` como comando de inicialização. Não é necessário
   instalar dependências; caso o formulário exija um comando de build, use
   `npm install`. O serviço usa a porta fornecida pelo Render.
3. Após o deploy, copie a URL real do serviço, por exemplo
   `https://seu-chat.onrender.com`. Altere `URL_BASE` em `cliente.py` para essa
   URL, faça commit e push, e aguarde o novo deploy. Assim, o arquivo distribuído
   por `/cliente` já estará configurado. A URL inicial `https://onrender.com` é
   apenas um marcador e não é o endereço do seu serviço.

## Baixar e executar

Substitua `https://seu-chat.onrender.com` pela URL real do serviço:

**Windows (CMD ou PowerShell):**

```powershell
curl.exe -fL https://terminalchat-b1g4.onrender.com//cliente -o cliente.py
py cliente.py
```

Se o comando `py` não estiver disponível, use `python cliente.py`.

**Linux:**

```sh
curl -fL https://seu-chat.onrender.com/cliente -o cliente.py
python3 cliente.py
```

Digite seu nome e envie mensagens; use `sair` ou Ctrl+C para encerrar. A primeira
conexão espera até 60 segundos para permitir que um serviço inativo desperte.
No terminal, a chegada de mensagens redesenha o prompt, mas o texto que estiver
sendo digitado pode não ser redesenhado visualmente em todos os terminais.

Para testar localmente, execute `npm start` nesta pasta e altere `URL_BASE` no
cliente para `http://localhost:8080`.

Este é um chat público de demonstração: não há autenticação, criptografia
própria, moderação ou persistência. Use HTTPS no deploy, não compartilhe
informações sensíveis e mantenha apenas uma instância do servidor, pois cada
instância possui sua própria lista de mensagens.
