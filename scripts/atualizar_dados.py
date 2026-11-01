"""Atualiza site/data/painel.json a partir de fontes públicas (sem credenciais)."""
from __future__ import annotations

import email.utils
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEST = BASE_DIR / 'site' / 'data' / 'painel.json'
AGGREGATE_URL = (
    'https://servicodados.ibge.gov.br/api/v3/agregados/6579/'
    'periodos/-1/variaveis/9324?localidades=N6%5B4106902%2C4125506%5D'
)
FEEDS = [
    ('Celulares', 'celulares OR smartphones'),
    ('Tecnologia', 'eletrônicos OR tecnologia'),
]
GOOGLE_NEWS_FEED = 'https://news.google.com/rss/search?'
MUNICIPALITIES = {'4106902': 'Curitiba', '4125506': 'São José dos Pinhais'}
USER_AGENT = 'ObservatorioPublico/1.0 (painel de investigacao; dados publicos)'


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, application/rss+xml, application/xml, text/xml, */*',
    })
    with urllib.request.urlopen(req, timeout=22) as response:
        return response.read()


def extract_population(raw: bytes) -> dict:
    data = json.loads(raw.decode('utf-8-sig'))
    municipalities = {}
    for variable in data:
        for result in variable.get('resultados', []):
            for series in result.get('series', []):
                loc = series.get('localidade', {})
                code = str(loc.get('id', ''))
                if code not in MUNICIPALITIES:
                    continue
                observations = series.get('serie', {})
                valid = [(str(year), str(value)) for year, value in observations.items()
                         if re.fullmatch(r'\d{4}', str(year)) and re.fullmatch(r'\d+', str(value))]
                if not valid:
                    continue
                year, value = max(valid, key=lambda pair: pair[0])
                municipalities[code] = {'nome': MUNICIPALITIES[code], 'ano': year, 'valor': int(value)}
    if set(municipalities) != set(MUNICIPALITIES):
        raise ValueError('A API do IBGE não retornou números válidos para ambos os municípios')
    return {'fonte': 'IBGE / SIDRA · tabela 6579 · variável 9324',
            'url': 'https://sidra.ibge.gov.br/tabela/6579',
            'municipios': municipalities}


def child_text(item: ET.Element, name: str) -> str:
    element = item.find(name)
    return (element.text or '').strip() if element is not None else ''


def parse_rss(raw: bytes, category: str) -> list[dict]:
    root = ET.fromstring(raw)
    parsed = []
    for item in root.findall('.//item')[:20]:
        title = child_text(item, 'title')
        link = child_text(item, 'link')
        rawdate = child_text(item, 'pubDate')
        source = item.find('source')
        publisher = (source.text or '').strip() if source is not None and source.text else 'Google Notícias'
        if not title or not link or not link.startswith(('https://', 'http://')):
            continue
        date_iso, display_date = '', 'Data não informada'
        if rawdate:
            try:
                parsed_date = email.utils.parsedate_to_datetime(rawdate)
                date_iso = parsed_date.astimezone(timezone.utc).isoformat()
                display_date = parsed_date.astimezone(timezone.utc).strftime('%d/%m/%Y')
            except (ValueError, TypeError, OverflowError):
                pass
        parsed.append({'titulo': title[:240], 'url': link, 'fonte': publisher[:90],
                       'data_publicacao': display_date, 'data_iso': date_iso, 'categoria': category})
    return parsed


def build() -> dict:
    payload = {
        'coletado_em': datetime.now(timezone.utc).isoformat(),
        'populacao': {'fonte': 'IBGE / SIDRA', 'municipios': {}},
        'noticias': [],
        'erros': [],
    }
    try:
        payload['populacao'] = extract_population(download(AGGREGATE_URL))
        print('IBGE: população carregada')
    except Exception as exc:
        payload['erros'].append(f'IBGE indisponível ({type(exc).__name__})')
        print('IBGE:', repr(exc))

    all_news = []
    for category, query in FEEDS:
        url = GOOGLE_NEWS_FEED + urllib.parse.urlencode({
            'q': query, 'hl': 'pt-BR', 'gl': 'BR', 'ceid': 'BR:pt-419'
        })
        try:
            found = parse_rss(download(url), category)
            all_news.extend(found)
            print(f'RSS {category}: {len(found)} matérias')
        except Exception as exc:
            payload['erros'].append(f'RSS {category} indisponível ({type(exc).__name__})')
            print('RSS:', repr(exc))
    dedup = {}
    for article in all_news:
        dedup.setdefault(article['url'], article)
    payload['noticias'] = sorted(dedup.values(), key=lambda n: n['data_iso'], reverse=True)[:24]
    if not payload['noticias']:
        payload['erros'].append('Nenhuma manchete RSS disponível')
    return payload


if __name__ == '__main__':
    DEST.parent.mkdir(parents=True, exist_ok=True)
    data = build()
    DEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Arquivo gerado:', DEST)
    print('Quantidade de fontes com resultados:', bool(data['populacao']['municipios']) + bool(data['noticias']))
    print('Avisos:', data['erros'])
