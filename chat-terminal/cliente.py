import json
import os
import sys
import threading
import urllib.request
from datetime import datetime

if os.name == "nt":
    os.system("chcp 65001 > nul")

URL_BASE = "https://terminalchat-b1g4.onrender.com/"
INTERVALO = 1.5
TIMEOUT = 60
LARGURA = 68


def requisicao(caminho, dados=None):
    corpo = None
    cabecalhos = {}
    if dados is not None:
        corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8")
        cabecalhos["Content-Type"] = "application/json; charset=utf-8"
    pedido = urllib.request.Request(
        URL_BASE.rstrip("/") + caminho, data=corpo, headers=cabecalhos
    )
    with urllib.request.urlopen(pedido, timeout=TIMEOUT) as resposta:
        return json.loads(resposta.read().decode("utf-8"))


def enviar(texto, autor, cliente, tipo="user"):
    resposta = requisicao(
        "/enviar", {"texto": texto, "autor": autor, "cliente": cliente, "tipo": tipo}
    )
    if not isinstance(resposta, dict) or resposta.get("ok") is not True:
        raise ValueError("Resposta inesperada ao enviar mensagem")


def limpar_chat(autor):
    resposta = requisicao("/limpar", {"autor": autor})
    if not isinstance(resposta, dict) or resposta.get("ok") is not True:
        raise ValueError("Resposta inesperada ao limpar o chat")


def obter_mensagens(desde):
    mensagens = requisicao("/mensagens?desde=" + str(desde))
    if not isinstance(mensagens, list):
        raise ValueError("Resposta inesperada ao buscar mensagens")
    for mensagem in mensagens:
        if (
            not isinstance(mensagem, dict)
            or not isinstance(mensagem.get("id"), int)
            or not isinstance(mensagem.get("texto"), str)
            or not isinstance(mensagem.get("autor"), str)
        ):
            raise ValueError("Mensagem inválida recebida do servidor")
    return mensagens


def horario(mensagem):
    try:
        return datetime.fromisoformat(mensagem.get("criadoEm", "").replace("Z", "+00:00")).astimezone().strftime("%H:%M")
    except (ValueError, TypeError):
        return "--:--"


def formatar(mensagem, cliente_atual=None):
    tipo = mensagem.get("tipo", "user")
    if tipo == "system":
        return "\n  • " + mensagem["texto"]

    eh_propria = cliente_atual and mensagem.get("cliente") == cliente_atual
    autor = "Você" if eh_propria else ("Assistente" if tipo == "assistant" else mensagem["autor"])
    titulo = "[" + horario(mensagem) + "] " + autor
    linhas = mensagem["texto"].splitlines() or [""]
    corpo = "\n".join("  " + linha for linha in linhas)
    return "\n" + titulo + "\n" + corpo


def imprimir(mensagem, cliente_atual=None, prompt=True):
    saida = formatar(mensagem, cliente_atual)
    if prompt:
        print("\r" + saida + "\n\n› ", end="", flush=True)
    else:
        print(saida)


def acompanhar(ultimo_id, cliente, encerrando):
    while not encerrando.wait(INTERVALO):
        try:
            mensagens = obter_mensagens(ultimo_id)
            for mensagem in mensagens:
                ultimo_id = max(ultimo_id, mensagem["id"])
                if mensagem.get("cliente") != cliente:
                    imprimir(mensagem, cliente)
        except (OSError, ValueError) as erro:
            print("\r\n[Erro de conexão] " + str(erro) + "\n\n› ", end="", flush=True)


def main():
    try:
        mensagens = obter_mensagens(0)
        ultimo_id = max((mensagem["id"] for mensagem in mensagens), default=0)
    except (OSError, ValueError) as erro:
        print("Não foi possível conectar ao servidor: " + str(erro), file=sys.stderr)
        return 1

    try:
        nome = input("Seu nome: ").strip()
    except (KeyboardInterrupt, EOFError):
        print()
        return 0
    if not nome:
        print("O nome não pode ficar vazio.", file=sys.stderr)
        return 1

    cliente = os.urandom(16).hex()
    print("\n" + "═" * LARGURA)
    print("  CHAT TERMINAL  •  /limpar limpa o chat  •  sair encerra")
    print("═" * LARGURA)
    if mensagens:
        print("\nCONVERSA RECENTE")
        for mensagem in mensagens:
            imprimir(mensagem, cliente, prompt=False)
        print("\n" + "─" * LARGURA)

    try:
        enviar(nome + " entrou no chat.", nome, cliente, "system")
    except (OSError, ValueError) as erro:
        print("Não foi possível anunciar a entrada: " + str(erro), file=sys.stderr)
        return 1

    encerrando = threading.Event()
    thread = threading.Thread(target=acompanhar, args=(ultimo_id, cliente, encerrando), daemon=True)
    thread.start()
    try:
        while True:
            texto = input("\n› ").strip()
            if texto.lower() == "sair":
                break
            if texto.lower() == "/limpar":
                try:
                    limpar_chat(nome)
                    os.system("cls" if os.name == "nt" else "clear")
                    print("Chat limpo. As novas mensagens aparecerão abaixo.")
                except (OSError, ValueError) as erro:
                    print("[Não foi possível limpar] " + str(erro), file=sys.stderr)
                continue
            if texto:
                try:
                    enviar(texto, nome, cliente)
                except (OSError, ValueError) as erro:
                    print("[Não foi possível enviar] " + str(erro), file=sys.stderr)
    except (KeyboardInterrupt, EOFError):
        print()
    finally:
        encerrando.set()
        try:
            enviar(nome + " saiu do chat.", nome, cliente, "system")
        except (OSError, ValueError):
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
