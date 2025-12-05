import os
import sys
import logging
import time
import re
import uuid
import json
import threading
from datetime import datetime
from flask import Flask, request, jsonify, Response
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
import fitz  # PyMuPDF
from bs4 import BeautifulSoup
from html import unescape

# Selenium Imports
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# --- Configuração Inicial ---

app = Flask(__name__)
app.secret_key = 'crm_virgula_secret_key'

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

# Diretório de Uploads
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'sefaz_uploads')
ALLOWED_EXTENSIONS = {'pdf'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Banco de Dados
db_path = os.path.join(os.getcwd(), 'consultas.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Modelos do Banco de Dados ---

class Consulta(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    filename = db.Column(db.String(120))
    total = db.Column(db.Integer, default=0)
    processed = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20)) # processing, completed, error
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime)
    results = db.relationship('Resultado', backref='consulta', lazy=True)

class Resultado(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    consulta_id = db.Column(db.String(36), db.ForeignKey('consulta.id'))
    
    # Dados SEFAZ
    inscricao_estadual = db.Column(db.String(20))
    cnpj = db.Column(db.String(20))
    razao_social = db.Column(db.String(200))
    nome_fantasia = db.Column(db.String(200))
    unidade_fiscalizacao = db.Column(db.String(100))
    logradouro = db.Column(db.String(200))
    bairro_distrito = db.Column(db.String(100))
    municipio = db.Column(db.String(100))
    uf = db.Column(db.String(2))
    cep = db.Column(db.String(10))
    telefone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    atividade_economica_principal = db.Column(db.String(200))
    condicao = db.Column(db.String(100))
    forma_pagamento = db.Column(db.String(100))
    situacao_cadastral = db.Column(db.String(100))
    data_situacao_cadastral = db.Column(db.String(20))
    motivo_situacao_cadastral = db.Column(db.String(200))
    nome_contador = db.Column(db.String(100))
    status = db.Column(db.String(20)) # Sucesso, Erro

    # Campos do CRM
    campaign_status = db.Column(db.String(50), default='pending') # pending, sent, replied
    last_contacted = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

# --- Criação das Tabelas ---
with app.app_context():
    try:
        db.create_all()
    except Exception as e:
        logging.warning(f"Aviso DB: {e}")

# --- Funções Auxiliares ---

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def configurar_navegador():
    try:
        options = Options()
        options.add_argument('--headless=new') 
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--disable-extensions')
        
        chromedriver_path = '/usr/bin/chromedriver'
        service = Service(executable_path=chromedriver_path)
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except Exception as e:
        logging.error(f"Erro ao configurar navegador: {e}")
        raise

def extrair_ie_pdf(filepath):
    ies = []
    try:
        logging.info(f"Lendo PDF: {filepath}")
        padrao = re.compile(r'(\d{1,3}\.\d{1,3}\.\d{1,3})\s*-')
        doc = fitz.open(filepath)
        for page in doc:
            text = page.get_text("text")
            matches = padrao.finditer(text)
            for match in matches:
                ie_limpa = re.sub(r'\D', '', match.group(1))
                if len(ie_limpa) == 9:
                    ies.append(ie_limpa)
        doc.close()
        return list(set(ies))
    except Exception as e:
        logging.error(f"Erro ao ler PDF: {e}")
        return []

def consultar_ie(driver, wait, ie):
    try:
        driver.get('https://portal.sefaz.ba.gov.br/scripts/cadastro/cadastroBa/consultaBa.asp')
        campo_ie = wait.until(EC.presence_of_element_located((By.NAME, 'IE')))
        campo_ie.clear()
        campo_ie.send_keys(ie)
        botao = wait.until(EC.element_to_be_clickable((By.XPATH, "//input[@type='submit' and @name='B2' and contains(@value, 'IE')]")))
        botao.click()
        wait.until(EC.url_contains('result.asp'))
        return True
    except Exception as e:
        logging.warning(f"Falha na navegação IE {ie}: {e}")
        return False

def extrair_dados_resultado(driver, inscricao_estadual):
    try:
        WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.XPATH, "//td[contains(., 'Consulta Básica ao Cadastro do ICMS da Bahia')]")))
        html = driver.page_source
        soup = BeautifulSoup(html, 'html.parser')
        
        dados = { 'Inscrição Estadual': inscricao_estadual, 'Status': 'Sucesso', 'Motivo Situação Cadastral': 'Não informado' }
        def limpar_texto(t): return unescape(str(t)).replace('\xa0', ' ').strip() if t else None

        campos_map = {
            'CNPJ': ['CNPJ:'], 'Razão Social': ['Razão Social:'], 'Nome Fantasia': ['Nome Fantasia:'],
            'Unidade de Fiscalização': ['Unidade de Fiscalização:'], 'Logradouro': ['Logradouro:'],
            'Bairro/Distrito': ['Bairro/Distrito:'], 'Município': ['Município:'], 'UF': ['UF:'],
            'CEP': ['CEP:'], 'Telefone': ['Telefone:'], 'E-mail': ['E-mail:'],
            'Condição': ['Condição:'], 'Forma de pagamento': ['Forma de pagamento:'],
            'Situação Cadastral Vigente': ['Situação Cadastral Vigente:'],
            'Motivo Situação Cadastral': ['Motivo desta Situação Cadastral:'],
            'Data Situação Cadastral': ['Data desta Situação Cadastral:'], 'Nome (Contador)': ['Nome:']
        }

        for campo, labels in campos_map.items():
            for label in labels:
                tag = soup.find('b', string=lambda t: t and limpar_texto(label) in limpar_texto(t))
                if tag and tag.next_sibling: dados[campo] = limpar_texto(tag.next_sibling)

        tag_ativ = soup.find('b', string=lambda t: t and 'Atividade Econômica' in limpar_texto(t))
        if tag_ativ and tag_ativ.find_parent('tr'):
            prox = tag_ativ.find_parent('tr').find_next_sibling('tr')
            if prox: dados['Atividade Econômica Principal'] = limpar_texto(prox.get_text())

        return dados
    except Exception as e:
        logging.error(f"Erro parser HTML: {e}")
        return {'Inscrição Estadual': inscricao_estadual, 'Status': f'Erro: {str(e)}'}

def thread_processamento(filepath, process_id, is_reprocess=False):
    """Executa scraping. Se is_reprocess=True, usa IEs do banco em vez do PDF."""
    with app.app_context():
        consulta = Consulta.query.get(process_id)
        if not consulta: return

        ies = []
        if is_reprocess:
            # Busca todas as IEs deste lote no banco
            existing_results = Resultado.query.filter_by(consulta_id=process_id).all()
            ies = [r.inscricao_estadual for r in existing_results]
            # Limpa resultados antigos ou atualiza? Por enquanto atualizamos
            logging.info(f"Reprocessando {len(ies)} IEs do lote {process_id}")
        else:
            ies = extrair_ie_pdf(filepath)
        
        if not ies:
            consulta.status = 'completed'; consulta.end_time = datetime.now(); db.session.commit()
            return

        consulta.total = len(ies)
        consulta.processed = 0
        db.session.commit()
        
        driver = configurar_navegador()
        wait = WebDriverWait(driver, 10)

        for index, ie in enumerate(ies):
            try:
                if consultar_ie(driver, wait, ie):
                    dados = extrair_dados_resultado(driver, ie)
                    
                    if is_reprocess:
                        # Atualiza registro existente
                        res = Resultado.query.filter_by(consulta_id=process_id, inscricao_estadual=ie).first()
                        if res:
                            res.situacao_cadastral = dados.get('Situação Cadastral Vigente')
                            res.motivo_situacao_cadastral = dados.get('Motivo Situação Cadastral')
                            res.status = 'Sucesso'
                            # Atualiza outros campos se necessário
                    else:
                        # Cria novo
                        resultado = Resultado(
                            consulta_id=process_id,
                            inscricao_estadual=dados.get('Inscrição Estadual'),
                            cnpj=dados.get('CNPJ'),
                            razao_social=dados.get('Razão Social'),
                            nome_fantasia=dados.get('Nome Fantasia'),
                            unidade_fiscalizacao=dados.get('Unidade de Fiscalização'),
                            logradouro=dados.get('Logradouro'),
                            bairro_distrito=dados.get('Bairro/Distrito'),
                            municipio=dados.get('Município'),
                            uf=dados.get('UF'),
                            cep=dados.get('CEP'),
                            telefone=dados.get('Telefone'),
                            email=dados.get('E-mail'),
                            atividade_economica_principal=dados.get('Atividade Econômica Principal'),
                            condicao=dados.get('Condição'),
                            forma_pagamento=dados.get('Forma de pagamento'),
                            situacao_cadastral=dados.get('Situação Cadastral Vigente'),
                            data_situacao_cadastral=dados.get('Data Situação Cadastral'),
                            motivo_situacao_cadastral=dados.get('Motivo Situação Cadastral'),
                            nome_contador=dados.get('Nome (Contador)'),
                            status='Sucesso', campaign_status='pending'
                        )
                        db.session.add(resultado)
                else:
                    if not is_reprocess:
                        db.session.add(Resultado(consulta_id=process_id, inscricao_estadual=ie, status='Erro: Navegação', campaign_status='error'))
                
                consulta.processed = index + 1; db.session.commit()
                time.sleep(1)
            except Exception as e:
                logging.error(f"Erro item {ie}: {e}")
                consulta.processed = index + 1; db.session.commit()

        driver.quit()
        consulta.status = 'completed'; consulta.end_time = datetime.now(); db.session.commit()

# --- Rotas da API ---

@app.route('/start-processing', methods=['POST'])
def start_processing():
    if 'file' not in request.files: return jsonify({'error': 'Nenhum arquivo'}), 400
    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename): return jsonify({'error': 'Arquivo inválido'}), 400
    
    process_id = str(uuid.uuid4())
    filename = secure_filename(f"{process_id}.pdf")
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    db.session.add(Consulta(id=process_id, filename=file.filename, total=0, processed=0, status='processing', start_time=datetime.now()))
    db.session.commit()
    
    threading.Thread(target=thread_processamento, args=(filepath, process_id, False)).start()
    return jsonify({'processId': process_id})

@app.route('/reprocess/<process_id>', methods=['POST'])
def reprocess(process_id):
    consulta = Consulta.query.get(process_id)
    if not consulta: return jsonify({'error': 'Processo não encontrado'}), 404
    
    consulta.status = 'processing'
    consulta.processed = 0
    consulta.start_time = datetime.now()
    db.session.commit()
    
    # Não precisa de arquivo, usa o banco
    threading.Thread(target=thread_processamento, args=(None, process_id, True)).start()
    return jsonify({'success': True})

@app.route('/progress/<process_id>')
def progress(process_id):
    def generate():
        with app.app_context():
            last_processed = -1
            while True:
                consulta = Consulta.query.get(process_id)
                if not consulta: yield f"data: {json.dumps({'status': 'not_found'})}\n\n"; break
                if consulta.processed != last_processed or consulta.status in ['completed', 'error']:
                    yield f"data: {json.dumps({'total': consulta.total, 'processed': consulta.processed, 'status': consulta.status})}\n\n"
                    last_processed = consulta.processed
                if consulta.status in ['completed', 'error']: break
                time.sleep(1)
    return Response(generate(), mimetype='text/event-stream')

@app.route('/get-all-results')
def get_all_results():
    resultados = Resultado.query.order_by(Resultado.id.desc()).all()
    return jsonify([{
        'id': str(r.id), 'inscricaoEstadual': r.inscricao_estadual, 'cnpj': r.cnpj, 'razaoSocial': r.razao_social,
        'municipio': r.municipio, 'telefone': r.telefone, 'situacaoCadastral': r.situacao_cadastral,
        'motivoSituacao': r.motivo_situacao_cadastral, 'nomeContador': r.nome_contador,
        'status': r.status, 'campaignStatus': r.campaign_status
    } for r in resultados])

@app.route('/get-imports')
def get_imports():
    consultas = Consulta.query.order_by(Consulta.start_time.desc()).all()
    return jsonify([{
        'id': c.id, 'filename': c.filename, 'date': c.start_time.isoformat(),
        'total': c.total, 'status': c.status
    } for c in consultas])

@app.route('/get-results/<process_id>')
def get_results_by_id(process_id):
    # Simplificado para evitar payload gigante desnecessário
    return jsonify({'results': []}) 

# --- Endpoints para Filtros e IA ---

@app.route('/api/unique-filters')
def unique_filters():
    # Obtém lista distinta de Motivos e Municípios
    motivos = db.session.query(Resultado.motivo_situacao_cadastral).distinct().all()
    municipios = db.session.query(Resultado.municipio).distinct().all()
    
    return jsonify({
        'motivos': [m[0] for m in motivos if m[0]],
        'municipios': [m[0] for m in municipios if m[0]]
    })

@app.route('/api/identify-contact/<phone>')
def identify_contact(phone):
    # Remove chars não numéricos
    clean_phone = re.sub(r'\D', '', phone) 
    # Tenta casar os ultimos 8 digitos (evita problema com 9 digito e DDI)
    suffix = clean_phone[-8:]
    
    res = Resultado.query.filter(Resultado.telefone.like(f'%{suffix}')).first()
    
    if res:
        return jsonify({
            'found': True,
            'razaoSocial': res.razao_social,
            'municipio': res.municipio,
            'situacao': res.situacao_cadastral,
            'motivoSituacao': res.motivo_situacao_cadastral
        })
    else:
        return jsonify({'found': False})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
