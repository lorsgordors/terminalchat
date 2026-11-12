'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const mensagens = [];
let proximoId = 1;
const limiteCorpo = 16 * 1024;

function responderJson(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(dados));
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor de chat online.\n');
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
    req.on('end', () => {
      if (excedeuLimite) return;
      let dados;
      try {
        dados = JSON.parse(Buffer.concat(partes).toString('utf8'));
      } catch (erro) {
        responderJson(res, 400, { erro: 'JSON inválido.' });
        return;
      }
      if (!dados || typeof dados !== 'object' || Array.isArray(dados) ||
          typeof dados.texto !== 'string' || !dados.texto.trim() ||
          dados.texto.length > 2000 ||
          (dados.cliente !== undefined &&
           (typeof dados.cliente !== 'string' || dados.cliente.length > 100))) {
        responderJson(res, 400, { erro: 'Texto ou identificador de cliente inválido.' });
        return;
      }
      const mensagem = { id: proximoId++, texto: dados.texto };
      if (dados.cliente !== undefined) mensagem.cliente = dados.cliente;
      mensagens.push(mensagem);
      if (mensagens.length > 50) mensagens.shift();
      responderJson(res, 200, { ok: true });
    });
    req.on('error', (erro) => {
      console.error('Erro ao receber requisição:', erro);
    });
    return;
  }

  responderJson(res, 404, { erro: 'Rota não encontrada.' });
});

servidor.listen(process.env.PORT || 8080, '0.0.0.0', () => {
  console.log('Servidor de chat iniciado.');
});
