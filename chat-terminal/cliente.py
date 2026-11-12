import urllib.request
import json
import threading
import sys
import os

if os.name == "nt":
    os.system("chcp 65001 > nul")

URL_BASE = "https://terminalchat-b1g4.onrender.com/"
INTERVALO = 1.5
TIMEOUT = 60


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


def enviar(texto, cliente):
    resposta = requisicao("/enviar", {"texto": texto, "cliente": cliente})
    if not isinstance(resposta, dict) or resposta.get("ok") is not True:
        raise ValueError("Resposta inesperada ao enviar mensagem")


def obter_mensagens(desde):
    mensagens = requisicao("/mensagens?desde=" + str(desde))
    if not isinstance(mensagens, list):
        raise ValueError("Resposta inesperada ao buscar mensagens")
    for mensagem in mensagens:
        if (
            not isinstance(mensagem, dict)
            or not isinstance(mensagem.get("id"), int)
            or not isinstance(mensagem.get("texto"), str)
        ):
            raise ValueError("Mensagem inválida recebida do servidor")
    return mensagens


def acompanhar(ultimo_id, cliente, encerrando):
    while not encerrando.wait(INTERVALO):
        try:
            mensagens = obter_mensagens(ultimo_id)
            for mensagem in mensagens:
                ultimo_id = max(ultimo_id, mensagem["id"])
                if mensagem.get("cliente") != cliente:
                    print("\r" + mensagem["texto"] + "\nVocê: ", end="", flush=True)
        except (OSError, ValueError) as erro:
            print("\rErro ao buscar mensagens: " + str(erro) + "\nVocê: ", end="", flush=True)


def main():
    try:
        mensagens = obter_mensagens(0)
        ultimo_id = max((mensagem["id"] for mensagem in mensagens), default=0)
        if mensagens:
            print("--- Mensagens anteriores ---")
            for mensagem in mensagens:
                print(mensagem["texto"])
            print("----------------------------")
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
    try:
        enviar("*** " + nome + " entrou no chat ***", cliente)
    except (OSError, ValueError) as erro:
        print("Não foi possível anunciar a entrada: " + str(erro), file=sys.stderr)
        return 1

    encerrando = threading.Event()
    thread = threading.Thread(
        target=acompanhar, args=(ultimo_id, cliente, encerrando), daemon=True
    )
    thread.start()
    try:
        while True:
            texto = input("Você: ").strip()
            if texto.lower() == "sair":
                break
            if texto:
                try:
                    enviar(nome + ": " + texto, cliente)
                except (OSError, ValueError) as erro:
                    print("Não foi possível enviar a mensagem: " + str(erro), file=sys.stderr)
    except (KeyboardInterrupt, EOFError):
        print()
    finally:
        encerrando.set()
        try:
            enviar("*** " + nome + " saiu do chat ***", cliente)
        except (OSError, ValueError) as erro:
            print("Não foi possível anunciar a saída: " + str(erro), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
