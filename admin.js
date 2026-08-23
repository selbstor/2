// ============================================
// Gerenciador de Produtos — Achadinhos (v3)
// Mapeamento EXATO da planilha real
// ============================================

const URL_GRAVAR_PRODUTOS = ACHADINHOS.registrar_cliques;

let produtos = [];
let produtoEditando = null;

// ============ CARREGAR ============
async function carregarProdutos() {
  const corpo = document.getElementById('corpoTabela');
  corpo.innerHTML = '<tr><td colspan="7" class="vazio">Carregando...</td></tr>';

  try {
    const resp = await fetch(ACHADINHOS.planilha_catalogo + '&t=' + Date.now());
    const texto = await resp.text();
    produtos = parseCSV(texto);
    renderizarTabela();
  } catch (e) {
    corpo.innerHTML = '<tr><td colspan="7" class="vazio">❌ Erro: ' + e.message + '</td></tr>';
    toast('Erro ao carregar', 'erro');
  }
}

function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return [];

  const cabecalhos = parseLinha(linhas[0]);
  console.log('Cabeçalhos reais:', cabecalhos);

  return linhas.slice(1).map((l, i) => {
    const cols = parseLinha(l);
    const obj = { _linha: i + 2 };
    cabecalhos.forEach((h, idx) => { obj[h] = cols[idx] || ''; });
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

// ============ HELPER: buscar campo ignorando maiúsculas/acentos ============
function get(p, ...nomes) {
  for (const nome of nomes) {
    for (const chave of Object.keys(p)) {
      if (chave.startsWith('_')) continue;
      if (chave.toLowerCase().replace(/[^a-z0-9]/g,'') === nome.toLowerCase().replace(/[^a-z0-9]/g,'')) {
        return p[chave];
      }
    }
  }
  return '';
}

// ============ RENDERIZAR ============
function renderizarTabela() {
  const busca = document.getElementById('busca').value.toLowerCase();
  const filtro = document.getElementById('filtroStatus').value;
  const corpo = document.getElementById('corpoTabela');

  const filtrados = produtos.filter(p => {
    const nome = get(p, 'Nome').toLowerCase();
    const cat = get(p, 'Categoria').toLowerCase();
    const ativo = get(p, 'Ativo');
    const matchBusca = !busca || nome.includes(busca) || cat.includes(busca);
    const matchStatus = !filtro || ativo === filtro;
    return matchBusca && matchStatus;
  });

  if (filtrados.length === 0) {
    corpo.innerHTML = '<tr><td colspan="7" class="vazio">Nenhum produto encontrado</td></tr>';
    return;
  }

  corpo.innerHTML = filtrados.map(p => {
    const nome = get(p, 'Nome') || '(sem nome)';
    const img = get(p, 'Imagem 1') || '';
    const cat = get(p, 'Categoria') || '-';
    const preco = get(p, 'Preço Promocional') || get(p, 'Preço') || '-';
    const destaque = get(p, 'Destaque') || 'Não';
    const ativo = get(p, 'Ativo') || 'Sim';

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
function abrirModal() { document.getElementById('modal').classList.remove('oculto'); }
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

  document.getElementById('nome').value = get(p, 'Nome') || '';
  document.getElementById('descricao').value = get(p, 'Descrição') || get(p, 'Descricao') || '';
  document.getElementById('tipo').value = get(p, 'Tipo') || '';
  document.getElementById('plataforma').value = get(p, 'Plataforma') || '';
  document.getElementById('categoria').value = get(p, 'Categoria') || '';
  document.getElementById('subcategoria').value = get(p, 'Subcategoria') || '';
  document.getElementById('precoOriginal').value = get(p, 'Preço') || get(p, 'Preco') || '';
  document.getElementById('precoPromo').value = get(p, 'Preço Promocional') || get(p, 'Preco Promocional') || '';
  document.getElementById('cupom').value = get(p, 'Cupom') || '';
  document.getElementById('validade').value = get(p, 'Validade da oferta') || '';
  document.getElementById('link').value = get(p, 'Link de Afiliado') || get(p, 'Link') || '';
  document.getElementById('textoBotao').value = get(p, 'Texto do Botão') || '';
  document.getElementById('video').value = get(p, 'Vídeo (URL YouTube)') || get(p, 'Video') || '';
  document.getElementById('imagem1').value = get(p, 'Imagem 1') || get(p, 'Imagem') || '';
  document.getElementById('imagem2').value = get(p, 'Imagem 2') || '';
  document.getElementById('imagem3').value = get(p, 'Imagem 3') || '';
  document.getElementById('imagem4').value = get(p, 'Imagem 4') || '';
  document.getElementById('ordem').value = get(p, 'Ordem') || '';
  document.getElementById('destaque').value = get(p, 'Destaque') || 'Não';
  document.getElementById('ativo').value = get(p, 'Ativo') || 'Sim';

  abrirModal();
}

// ============ SALVAR ============
document.getElementById('formProduto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const linha = document.getElementById('campoLinha').value;

  const produto = {
    'Ativo': document.getElementById('ativo').value,
    'Tipo': document.getElementById('tipo').value.trim(),
    'Plataforma': document.getElementById('plataforma').value.trim(),
    'Categoria': document.getElementById('categoria').value.trim(),
    'Subcategoria': document.getElementById('subcategoria').value.trim(),
    'Nome': document.getElementById('nome').value.trim(),
    'Descrição': document.getElementById('descricao').value.trim(),
    'Preço': document.getElementById('precoOriginal').value.trim(),
    'Preço Promocional': document.getElementById('precoPromo').value.trim(),
    'Cupom': document.getElementById('cupom').value.trim(),
    'Validade da oferta': document.getElementById('validade').value.trim(),
    'Link de Afiliado': document.getElementById('link').value.trim(),
    'Texto do Botão': document.getElementById('textoBotao').value.trim(),
    'Vídeo (URL YouTube)': document.getElementById('video').value.trim(),
    'Imagem 1': document.getElementById('imagem1').value.trim(),
    'Imagem 2': document.getElementById('imagem2').value.trim(),
    'Imagem 3': document.getElementById('imagem3').value.trim(),
    'Imagem 4': document.getElementById('imagem4').value.trim(),
    'Ordem': document.getElementById('ordem').value.trim(),
    'Destaque': document.getElementById('destaque').value,
  };

  const dados = {
    acao: linha ? 'editar' : 'novo',
    linha: linha ? parseInt(linha) : null,
    produto: produto
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
    toast('❌ Erro: ' + err.message, 'erro');
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

carregarProdutos();
