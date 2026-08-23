// ============================================
// Gerenciador de Produtos — Achadinhos
// ============================================

// URL do Apps Script que grava na planilha (MESMA do config.js ou nova)
const URL_GRAVAR = ACHADINHOS.registrar_cliques; 
// ⚠️ IMPORTANTE: crie uma NOVA função no Apps Script para gravar produtos
// e coloque a URL aqui. Exemplo abaixo.
const URL_GRAVAR_PRODUTOS = ACHADINHOS.registrar_cliques; // ajuste se criar novo endpoint

let produtos = [];
let produtoEditando = null;

// ============ CARREGAR ============
async function carregarProdutos() {
  document.getElementById('corpoTabela').innerHTML =
    '<tr><td colspan="7" class="vazio">Carregando...</td></tr>';
  try {
    const resp = await fetch(ACHADINHOS.planilha_catalogo + '&t=' + Date.now());
    const texto = await resp.text();
    produtos = parseCSV(texto);
    renderizarTabela();
  } catch (e) {
    document.getElementById('corpoTabela').innerHTML =
      '<tr><td colspan="7" class="vazio">Erro ao carregar. Verifique a publicação da planilha.</td></tr>';
    toast('Erro ao carregar produtos', 'erro');
  }
}

function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return [];
  const cabecalhos = parseLinha(linhas[0]);
  return linhas.slice(1).map((l, i) => {
    const cols = parseLinha(l);
    const obj = { _linha: i + 2 }; // linha na planilha (1-based + header)
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

// ============ RENDERIZAR ============
function renderizarTabela() {
  const busca = document.getElementById('busca').value.toLowerCase();
  const filtro = document.getElementById('filtroStatus').value;
  const corpo = document.getElementById('corpoTabela');

  const filtrados = produtos.filter(p => {
    const nome = (p.Nome || p.nome || '').toLowerCase();
    const cat = (p.Categoria || p.categoria || '').toLowerCase();
    const matchBusca = !busca || nome.includes(busca) || cat.includes(busca);
    const matchStatus = !filtro || (p.Ativo || p.ativo || '') === filtro;
    return matchBusca && matchStatus;
  });

  if (filtrados.length === 0) {
    corpo.innerHTML = '<tr><td colspan="7" class="vazio">Nenhum produto encontrado</td></tr>';
    return;
  }

  corpo.innerHTML = filtrados.map(p => {
    const nome = p.Nome || p.nome || '(sem nome)';
    const img = p.Imagem || p.imagem || '';
    const cat = p.Categoria || p.categoria || '-';
    const preco = p['Preço Promocional'] || p.precoPromo || p.Preco || '-';
    const destaque = p.Destaque || p.destaque || 'Não';
    const ativo = p.Ativo || p.ativo || 'Sim';
    return `
      <tr>
        <td>${img ? `<img src="${img}" alt="">` : '—'}</td>
        <td><strong>${escapeHtml(nome)}</strong></td>
        <td>${escapeHtml(cat)}</td>
        <td>R$ ${escapeHtml(preco)}</td>
        <td><span class="badge badge-${destaque === 'Sim' ? 'destaque' : 'nao'}">${destaque}</span></td>
        <td><span class="badge badge-${ativo === 'Sim' ? 'sim' : 'nao'}">${ativo}</span></td>
<td class="acoes">
  <button class="btn btn-sm btn-icono" title="Editar produto" onclick="editar(${p._linha})">✏️</button>
  <button class="btn btn-sm btn-icono btn-danger" title="Excluir produto" onclick="excluir(${p._linha})">🗑️</button>
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
  document.getElementById('nome').value = p.Nome || p.nome || '';
  document.getElementById('descricao').value = p.Descricao || p.descricao || '';
  document.getElementById('precoOriginal').value = p['Preço Original'] || p.precoOriginal || '';
  document.getElementById('precoPromo').value = p['Preço Promocional'] || p.precoPromo || p.Preco || '';
  document.getElementById('link').value = p.Link || p.link || '';
  document.getElementById('imagem').value = p.Imagem || p.imagem || '';
  document.getElementById('categoria').value = p.Categoria || p.categoria || '';
  document.getElementById('loja').value = p.Loja || p.loja || '';
  document.getElementById('destaque').value = p.Destaque || p.destaque || 'Não';
  document.getElementById('ativo').value = p.Ativo || p.ativo || 'Sim';
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
    const resp = await fetch(URL_GRAVAR_PRODUTOS, {
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
