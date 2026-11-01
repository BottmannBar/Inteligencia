"""Coleta PTAX oficial e RSS de mercados para o site Tech-nigma.

Requisitos: somente biblioteca padrão do Python 3.11.
As cotações são fechamentos oficiais, NÃO preços em tempo real.
"""
from __future__ import annotations

import email.utils
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "site" / "data" / "mercados.json"
CURRENCIES = ("USD", "EUR", "CNY")
FEEDS = [
    ("FIIs", "fundos imobiliários FIIs B3 dividendos mercado"),
    ("Ações", "bolsa brasileira Ibovespa ações empresas B3 mercado"),
    ("Commodities", "ouro petróleo soja milho commodities cotações mercado"),
    ("Câmbio", "dólar euro yuan China real câmbio economia"),
]
HEADER = {
    "User-Agent": "TechNigmaResearch/2.0 (public financial sources; GitHub Actions)",
    "Accept": "application/json, application/xml, text/xml, application/rss+xml, */*",
}


def get(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(url, headers=HEADER)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def ptax_url(code: str, today: datetime) -> str:
    first = (today - timedelta(days=32)).strftime("%m-%d-%Y")
    last = today.strftime("%m-%d-%Y")
    params = urllib.parse.urlencode({
        "@codigoMoeda": f"'{code}'",
        "@dataInicialCotacao": f"'{first}'",
        "@dataFinalCotacao": f"'{last}'",
        "$format": "json",
        "$top": 1000,
    })
    path = (
        "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
        "CotacaoMoedaPeriodoFechamento(codigoMoeda=@codigoMoeda,"
        "dataInicialCotacao=@dataInicialCotacao,"
        "dataFinalCotacao=@dataFinalCotacao)"
    )
    return path + "?" + params


def ptax_alternative_url(code: str, today: datetime) -> str:
    first = (today - timedelta(days=32)).strftime("%m-%d-%Y")
    last = today.strftime("%m-%d-%Y")
    params = urllib.parse.urlencode({
        "@moeda": f"'{code}'",
        "@dataInicial": f"'{first}'",
        "@dataFinalCotacao": f"'{last}'",
        "$format": "json",
        "$top": 1000,
    })
    path = (
        "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
        "CotacaoMoedaPeriodo(moeda=@moeda,"
        "dataInicial=@dataInicial,"
        "dataFinalCotacao=@dataFinalCotacao)"
    )
    return path + "?" + params


def collect_currency(code: str, today: datetime) -> dict:
    try:
        rows = json.loads(get(ptax_url(code, today)).decode("utf-8-sig")).get("value", [])
        if not rows:
            raise ValueError(f"Sem registros no recurso principal para {code}")
    except Exception as primary_error:
        # Segundo recurso oficial: todos os boletins, filtrados por fechamento.
        try:
            rows = json.loads(get(ptax_alternative_url(code, today)).decode("utf-8-sig")).get("value", [])
        except Exception:
            raise primary_error
    valid = {}
    for row in rows:
        bulletin = str(row.get("tipoBoletim", "Fechamento")).lower()
        if "fechamento" not in bulletin:
            continue
        value = row.get("cotacaoVenda")
        stamp = str(row.get("dataHoraCotacao") or "")
        if not re.match(r"^\d{4}-\d{2}-\d{2}", stamp):
            continue
        try:
            price = float(value)
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue
        # Este recurso é de fechamento. Uma ocorrência por data.
        date = stamp[:10]
        if date not in valid or stamp > valid[date][0]:
            valid[date] = (stamp, price)
    ordered = sorted(valid.items())
    if not ordered:
        raise ValueError(f"Sem PTAX de fechamento para {code} no período")
    day, (_, current) = ordered[-1]
    previous = ordered[-2][1][1] if len(ordered) > 1 else None
    percent = round((current / previous - 1) * 100, 3) if previous else None
    return {
        "codigo": code,
        "venda": current,
        "data": datetime.strptime(day, "%Y-%m-%d").strftime("%d/%m/%Y"),
        "data_iso": day,
        "variacao_pct": percent,
        "fonte": "BCB / PTAX fechamento · venda",
        "url": "https://dadosabertos.bcb.gov.br/dataset/taxas-de-cambio-todos-os-boletins-diarios",
        "preservado": False,
    }


def child(item: ET.Element, tag: str) -> str:
    node = item.find(tag)
    return (node.text or "").strip() if node is not None else ""


def parse_rss(raw: bytes, group: str) -> list[dict]:
    root = ET.fromstring(raw)
    result = []
    for item in root.findall(".//item")[:16]:
        title = child(item, "title")
        link = child(item, "link")
        pub = child(item, "pubDate")
        node = item.find("source")
        publisher = node.text.strip() if node is not None and node.text else "Google Notícias"
        if not title or not link.startswith(("https://", "http://")):
            continue
        iso = ""
        shown = "Data não informada"
        try:
            d = email.utils.parsedate_to_datetime(pub).astimezone(timezone.utc)
            iso, shown = d.isoformat(), d.strftime("%d/%m/%Y")
        except (TypeError, ValueError, OverflowError, AttributeError):
            pass
        result.append({
            "titulo": title[:230],
            "url": link,
            "categoria": group,
            "fonte": publisher[:90],
            "data_publicacao": shown,
            "data_iso": iso,
        })
    return result


def collect_feed(group: str, phrase: str) -> list[dict]:
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({
        "q": phrase,
        "hl": "pt-BR",
        "gl": "BR",
        "ceid": "BR:pt-419",
    })
    return parse_rss(get(url), group)


def previous_data() -> dict:
    if not DEST.is_file():
        return {}
    try:
        return json.loads(DEST.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return {}


def main() -> None:
    before = previous_data()
    now = datetime.now(timezone.utc)
    payload = {"coletado_em": now.isoformat(), "cambio": {}, "noticias": [], "avisos": []}
    for currency in CURRENCIES:
        try:
            payload["cambio"][currency] = collect_currency(currency, now)
            print(f"PTAX {currency}: {payload['cambio'][currency]['venda']} — {payload['cambio'][currency]['data']}")
        except Exception as exc:
            old = before.get("cambio", {}).get(currency)
            if old and old.get("venda"):
                payload["cambio"][currency] = {**old, "preservado": True}
            payload["avisos"].append(f"PTAX {currency} indisponível ({type(exc).__name__})")
            print("PTAX:", currency, repr(exc))
    collected = []
    for group, query in FEEDS:
        try:
            found = collect_feed(group, query)
            collected.extend(found[:12])
            print("RSS", group, len(found))
        except Exception as exc:
            payload["avisos"].append(f"RSS {group} indisponível ({type(exc).__name__})")
            print("RSS:", group, repr(exc))
            # Preserva manchetes anteriores apenas da categoria indisponível.
            collected.extend(n for n in before.get("noticias", [])
                             if n.get("categoria") == group)
    uniq = {}
    for item in collected:
        uniq.setdefault(item["url"], item)
    payload["noticias"] = sorted(uniq.values(), key=lambda n: n.get("data_iso", ""),
                                reverse=True)[:60]
    if not payload["noticias"]:
        payload["avisos"].append("Sem notícias financeiras nesta coleta")
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
    print("Salvo:", DEST)
    print("Moedas com cotação:", len(payload["cambio"]))
    print("Manchetes:", len(payload["noticias"]))
    print("Avisos:", payload["avisos"])


if __name__ == "__main__":
    main()
