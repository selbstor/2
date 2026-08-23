// ============================================
// Gerenciador de Produtos — Achadinhos (v2)
// ============================================

const URL_GRAVAR_PRODUTOS = ACHADINHOS.registrar_cliques;

let produtos = [];
let produtoEditando = null;
let cabecalhosReais = []; // guarda os nomes reais das colunas

// ============ CARREGAR ============
async function carregarProdutos() {
  const corpo = document.getElementById('corpoTabela');
  corpo.innerHTML = '<tr><td colspan="7" class="vazio">Carregando...</td></tr>';
  
  try {
    const resp = await fetch(ACHADINHOS.planilha_catalogo + '&t=' + Date.now());
    const texto = await resp.text();
    
    console.log('=== RAW CSV (primeiros 500 chars) ===');
    console.log(texto.substring(0, 500));
    
    produtos = parseCSV(texto);
    renderizarTabela();
    mostrarDebugCabecalhos();
  } catch (e) {
    corpo.innerHTML = '<tr><td colspan="7" class="vazio">❌ Erro ao carregar: ' + e.message + '</td></tr>';
    toast('Erro ao carregar produtos', 'erro');
  }
}

function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return [];
  
  const cabecalhos = parseLinha(linhas[0]);
  cabecalhosReais = cabecalhos; // guarda para debug
  
  console.log('=== CABEÇALHOS REAIS DA PLANILHA ===');
  console.log(cabecalhos);
  
  return linhas.slice(1).map((l, i) => {
    const cols = parseLinha(l);
    const obj = { _linha: i + 2 };
    cabecalhos.forEach((h, idx) => {
      obj[h] = cols[idx] || '';
    });
    return obj;
  });
}

function parseLinha(linha) {
  const res = []; let atual = ''; let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { aspas = !aspas; }
    else if (c === ',' && !aspas) { res.push(atual.trim()); atual = ''; }
    else { atual += c; }
  }
  res.push(atual.trim());
  return res;
}

// ============ NORMALIZAÇÃO DE NOMES ============
function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, '') // remove espaços e símbolos
    .trim();
}

function buscarCampo(produto, nomesPossiveis) {
  // tenta cada nome possível (normalizado) contra cada chave real do produto
  for (const chave of Object.keys(produto)) {
    if (chave.startsWith('_')) continue;
    const chaveNorm = normalizar(chave);
    for (const nome of nomesPossiveis) {
      if (chaveNorm === normalizar(nome)) {
        return produto[chave];
      }
    }
  }
  return '';
}

// Mapeamento flexível: cada campo aceita várias variações
const MAPEAMENTO = {
  nome:         ['Nome', 'nome', 'titulo', 'título', 'product', 'produto'],
  descricao:    ['Descricao', 'Descrição', 'descricao', 'desc', 'description'],
  precoOriginal:['Preço Original', 'Preco Original', 'precooriginal', 'preco_original', 'preco de', 'precode', 'precoantigo', 'preco antigo'],
  precoPromo:   ['Preço Promocional', 'Preco Promocional', 'precopromo', 'preco_promo', 'preco', 'Preço', 'Preco', 'valor', 'precofinal', 'preco final'],
  link:         ['Link', 'link', 'url', 'URL', 'href', 'linkproduto', 'link produto'],
  imagem:       ['Imagem', 'imagem', 'img', 'foto', 'Foto', 'image', 'Image', 'urlimagem', 'url imagem'],
  categoria:    ['Categoria', 'categoria', 'cat', 'category', 'grupo'],
  loja:         ['Loja', 'loja', 'store', 'origem', 'marca', 'Marketplace'],
  destaque:     ['Destaque', 'destaque', 'featured', 'destacado', 'emdestaque'],
  ativo:        ['Ativo', 'ativo', 'status', 'Status', 'active', 'ativo?', 'sim', 'publicado']
};

function getCampo(produto, campo) {
  return buscarCampo(produto, MAPEAMENTO[campo] || [campo]);
}

// ============ RENDERIZAR ============
function renderizarTabela() {
  const busca = document.getElementById('busca').value.toLowerCase();
  const filtro = document.getElementById('filtroStatus').value;
  const corpo = document.getElementById('corpoTabela');

  const filtrados = produtos.filter(p => {
    const nome = getCampo(p, 'nome').toLowerCase();
    const cat = getCampo(p, 'categoria').toLowerCase();
    const matchBusca = !busca || nome.includes(busca) || cat.includes(busca);
    const ativo = getCampo(p, 'ativo');
    const matchStatus = !filtro || ativo === filtro;
    return matchBusca && matchStatus;
  });

  if (filtrados.length === 0) {
    corpo.innerHTML = '<tr><td colspan="7" class="vazio">Nenhum produto encontrado</td></tr>';
    return;
  }

  corpo.innerHTML = filtrados.map(p => {
    const nome = getCampo(p, 'nome') || '(sem nome)';
    const img = getCampo(p, 'imagem') || '';
    const cat = getCampo(p, 'categoria') || '-';
    const preco = getCampo(p, 'precoPromo') || getCampo(p, 'precoOriginal') || '-';
    const destaque = getCampo(p, 'destaque') || 'Não';
    const ativo = getCampo(p, 'ativo') || 'Sim';
    
    return `
      <tr>
        <td>${img ? `<img src="${img}" alt="" onerror="this.style.display='none'">` : '—'}</td>
        <td><strong>${escapeHtml(nome)}</strong></td>
        <td>${escapeHtml(cat)}</td>
        <td>R$ ${escapeHtml(preco)}</td>
        <td><span class="badge badge-${destaque === 'Sim' ? 'destaque' : 'nao'}">${destaque}</span></td>
        <td><span class="badge badge-${ativo === 'Sim' ? 'sim' : 'nao'}">${ativo}</span></td>
        <td class="acoes">
          <button class="btn btn-sm btn-icono" title="Editar produto" onclick="editar(${p._linha})">✏️</button>
          <button class="btn btn-sm btn-icono btn-danger" title="Excluir produto" onclick="excluir(${p._linha})">️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ============ PAINEL DE DEBUG ============
function mostrarDebugCabecalhos() {
  // Remove painel anterior se existir
  const anterior = document.getElementById('painelDebug');
  if (anterior) anterior.remove();
  
  const painel = document.createElement('div');
  painel.id = 'painelDebug';
  painel.style.cssText = 'margin:20px 30px;padding:15px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;font-size:13px;font-family:monospace;';
  
  painel.innerHTML = `
    <strong>🔍 Debug — Colunas detectadas na planilha:</strong><br>
    <code>${cabecalhosReais.join(' | ')}</code><br><br>
    <strong>Primeiro produto (dados brutos):</strong><br>
    <pre style="margin:5px 0;white-space:pre-wrap;">${JSON.stringify(produtos[0] || {}, null, 2)}</pre>
    <button onclick="this.parentElement.remove()" style="margin-top:8px;padding:4px 10px;border:none;background:#ffc107;border-radius:4px;cursor:pointer;">✕ Fechar</button>
  `;
  
  document.querySelector('.admin-main').insertBefore(painel, document.getElementById('tabelaWrap'));
}

// ============ MODAL ============
function abrirModal() {
  document.getElementById('modal').classList.remove('oculto');
}
function fecharModal() {
  document.getElementById('modal').classList.add('oculto');
  document.getElementById('formProduto').reset();
  produtoEditando = null;
}

function novoProduto() {
  produtoEditando = null;
  document.getElementById('modalTitulo').textContent = 'Novo Produto';
  document.getElementById('formProduto').reset();
  document.getElementById('campoLinha').value = '';
  abrirModal();
}

function editar(linha) {
  const p = produtos.find(x => x._linha === linha);
  if (!p) return;
  produtoEditando = p;
  document.getElementById('modalTitulo').textContent = 'Editar Produto';
  document.getElementById('campoLinha').value = linha;
  document.getElementById('nome').value = getCampo(p, 'nome') || '';
  document.getElementById('descricao').value = getCampo(p, 'descricao') || '';
  document.getElementById('precoOriginal').value = getCampo(p, 'precoOriginal') || '';
  document.getElementById('precoPromo').value = getCampo(p, 'precoPromo') || '';
  document.getElementById('link').value = getCampo(p, 'link') || '';
  document.getElementById('imagem').value = getCampo(p, 'imagem') || '';
  document.getElementById('categoria').value = getCampo(p, 'categoria') || '';
  document.getElementById('loja').value = getCampo(p, 'loja') || '';
  document.getElementById('destaque').value = getCampo(p, 'destaque') || 'Não';
  document.getElementById('ativo').value = getCampo(p, 'ativo') || 'Sim';
  abrirModal();
}

// ============ SALVAR ============
document.getElementById('formProduto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const linha = document.getElementById('campoLinha').value;
  const dados = {
    acao: linha ? 'editar' : 'novo',
    linha: linha ? parseInt(linha) : null,
    produto: {
      Nome: document.getElementById('nome').value.trim(),
      Descricao: document.getElementById('descricao').value.trim(),
      'Preço Original': document.getElementById('precoOriginal').value.trim(),
      'Preço Promocional': document.getElementById('precoPromo').value.trim(),
      Link: document.getElementById('link').value.trim(),
      Imagem: document.getElementById('imagem').value.trim(),
      Categoria: document.getElementById('categoria').value.trim(),
      Loja: document.getElementById('loja').value.trim(),
      Destaque: document.getElementById('destaque').value,
      Ativo: document.getElementById('ativo').value,
    }
  };

  try {
    toast('Salvando...', '');
    await fetch(URL_GRAVAR_PRODUTOS, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(dados)
    });
    toast('✅ Salvo! Recarregando...', 'sucesso');
    fecharModal();
    setTimeout(carregarProdutos, 1500);
  } catch (err) {
    toast('❌ Erro ao salvar: ' + err.message, 'erro');
  }
});

// ============ EXCLUIR ============
async function excluir(linha) {
  if (!confirm('Confirma a exclusão deste produto?')) return;
  try {
    toast('Excluindo...', '');
    await fetch(URL_GRAVAR_PRODUTOS, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ acao: 'excluir', linha: linha })
    });
    toast('✅ Excluído! Recarregando...', 'sucesso');
    setTimeout(carregarProdutos, 1500);
  } catch (err) {
    toast('❌ Erro: ' + err.message, 'erro');
  }
}

// ============ TOAST ============
function toast(msg, tipo) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (tipo || '');
  setTimeout(() => t.classList.add('oculto'), 3000);
}

// ============ EVENTOS ============
document.getElementById('btnNovo').onclick = novoProduto;
document.getElementById('btnRecarregar').onclick = carregarProdutos;
document.getElementById('busca').oninput = renderizarTabela;
document.getElementById('filtroStatus').onchange = renderizarTabela;

// Iniciar
carregarProdutos();
