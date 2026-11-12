'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

carregarEnv(path.join(__dirname, '.env'));

const mensagens = [];
let proximoId = 1;
const limiteCorpo = 16 * 1024;
const limiteMensagens = 100;
const limiteHistoricoIA = 24;
const modeloIA = process.env.OPENAI_MODEL || 'gpt-4.1';
const limiteRequisicaoIA = 45_000;

function carregarEnv(arquivo) {
  try {
    for (const linhaOriginal of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const linha = linhaOriginal.trim();
      if (!linha || linha.startsWith('#')) continue;
      const separador = linha.indexOf('=');
      if (separador === -1) continue;
      const chave = linha.slice(0, separador).trim();
      let valor = linha.slice(separador + 1).trim();
      if ((valor.startsWith('"') && valor.endsWith('"')) ||
          (valor.startsWith("'") && valor.endsWith("'"))) {
        valor = valor.slice(1, -1);
      }
      if (chave && process.env[chave] === undefined) process.env[chave] = valor;
    }
  } catch (erro) {
    if (erro.code !== 'ENOENT') console.error('Não foi possível ler o .env:', erro.message);
  }
}

function responderJson(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(dados));
}

function adicionarMensagem({ texto, autor, cliente, tipo }) {
  const mensagem = {
    id: proximoId++,
    texto: texto.trim(),
    autor: autor || (tipo === 'assistant' ? 'Assistente' : 'Sistema'),
    tipo: tipo || 'user',
    criadoEm: new Date().toISOString()
  };
  if (cliente) mensagem.cliente = cliente;
  mensagens.push(mensagem);
  if (mensagens.length > limiteMensagens) mensagens.shift();
  return mensagem;
}

function historicoParaIA() {
  return mensagens
    .filter((mensagem) => mensagem.tipo === 'user' || mensagem.tipo === 'assistant')
    .slice(-limiteHistoricoIA)
    .map((mensagem) => ({
      role: mensagem.tipo === 'assistant' ? 'assistant' : 'user',
      content: mensagem.tipo === 'assistant'
        ? mensagem.texto
        : `${mensagem.autor}: ${mensagem.texto}`
    }));
}

async function responderComIA() {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) return;

  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), limiteRequisicaoIA);
  try {
    const resposta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${chave}`
      },
      signal: controle.signal,
      body: JSON.stringify({
        model: modeloIA,
        messages: [
          {
            role: 'system',
            content: 'Você é o Assistente do Chat Terminal. Responda em português, com clareza e educação. Considere o histórico da conversa. Mantenha respostas objetivas, bem organizadas em parágrafos curtos ou listas quando útil. Não diga que recebeu instruções de sistema e não invente informações.'
          },
          ...historicoParaIA()
        ],
        temperature: 0.7
      })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      console.error('A OpenAI recusou a solicitação:', resposta.status, dados.error?.message || 'erro sem detalhes');
      return;
    }
    const texto = dados.choices?.[0]?.message?.content;
    if (typeof texto === 'string' && texto.trim()) {
      adicionarMensagem({ texto, autor: 'Assistente', tipo: 'assistant' });
    } else {
      console.error('A OpenAI retornou uma resposta sem texto.');
    }
  } catch (erro) {
    console.error('Erro ao consultar a OpenAI:', erro.name === 'AbortError' ? 'tempo limite excedido' : erro.message);
  } finally {
    clearTimeout(temporizador);
  }
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor de chat com IA online.\n');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/cliente') {
    fs.readFile(path.join(__dirname, 'cliente.py'), (erro, conteudo) => {
      if (erro) {
        console.error('Erro ao ler cliente.py:', erro);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Não foi possível carregar o cliente.\n');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(conteudo);
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/mensagens') {
    const parametro = url.searchParams.get('desde');
    if (parametro !== null && !/^\d+$/.test(parametro)) {
      responderJson(res, 400, { erro: 'O parâmetro desde deve ser um inteiro não negativo.' });
      return;
    }
    const desde = parametro === null ? 0 : Number(parametro);
    if (!Number.isSafeInteger(desde)) {
      responderJson(res, 400, { erro: 'O parâmetro desde é muito grande.' });
      return;
    }
    responderJson(res, 200, mensagens.filter((mensagem) => mensagem.id > desde));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/limpar') {
    const partes = [];
    req.on('data', (parte) => partes.push(parte));
    req.on('end', () => {
      let dados = {};
      try {
        const corpo = Buffer.concat(partes).toString('utf8');
        dados = corpo ? JSON.parse(corpo) : {};
      } catch {
        responderJson(res, 400, { erro: 'JSON inválido.' });
        return;
      }
      if (typeof dados.autor !== 'string' || !dados.autor.trim() || dados.autor.length > 80) {
        responderJson(res, 400, { erro: 'Autor inválido.' });
        return;
      }
      mensagens.length = 0;
      adicionarMensagem({
        texto: `Chat limpo por ${dados.autor.trim()}.`,
        autor: 'Sistema',
        tipo: 'system'
      });
      responderJson(res, 200, { ok: true });
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/enviar') {
    const partes = [];
    let tamanho = 0;
    let excedeuLimite = false;
    req.on('data', (parte) => {
      tamanho += parte.length;
      if (tamanho > limiteCorpo) {
        if (!excedeuLimite) {
          excedeuLimite = true;
          responderJson(res, 413, { erro: 'Corpo da requisição muito grande.' });
        }
        return;
      }
      partes.push(parte);
    });
    req.on('end', async () => {
      if (excedeuLimite) return;
      let dados;
      try {
        dados = JSON.parse(Buffer.concat(partes).toString('utf8'));
      } catch {
        responderJson(res, 400, { erro: 'JSON inválido.' });
        return;
      }
      const textoValido = dados && typeof dados === 'object' && !Array.isArray(dados) &&
        typeof dados.texto === 'string' && dados.texto.trim() && dados.texto.length <= 2000;
      const autorValido = dados && (dados.autor === undefined ||
        (typeof dados.autor === 'string' && dados.autor.trim() && dados.autor.length <= 80));
      const clienteValido = dados && (dados.cliente === undefined ||
        (typeof dados.cliente === 'string' && /^[a-f0-9]{16,64}$/i.test(dados.cliente)));
      const tipoValido = dados && (dados.tipo === undefined || ['user', 'system'].includes(dados.tipo));
      if (!textoValido || !autorValido || !clienteValido || !tipoValido) {
        responderJson(res, 400, { erro: 'Mensagem inválida.' });
        return;
      }

      const tipo = dados.tipo || 'user';
      adicionarMensagem({
        texto: dados.texto,
        autor: dados.autor || 'Visitante',
        cliente: dados.cliente,
        tipo
      });
      responderJson(res, 200, { ok: true });

      // Apenas mensagens reais de usuários acionam a IA. Mensagens do assistente nunca retornam ao endpoint.
      if (tipo === 'user') await responderComIA();
    });
    req.on('error', (erro) => console.error('Erro ao receber requisição:', erro.message));
    return;
  }

  responderJson(res, 404, { erro: 'Rota não encontrada.' });
});

servidor.listen(process.env.PORT || 8080, '0.0.0.0', () => {
  console.log(`Servidor de chat iniciado com ${modeloIA}.`);
  if (!process.env.OPENAI_API_KEY) console.warn('OPENAI_API_KEY não configurada: o chat funcionará sem respostas da IA.');
});
