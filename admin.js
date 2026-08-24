const URL_GRAVAR_PRODUTOS = ACHADINHOS.registrar_cliques;
let produtos = [];

async function carregarProdutos() {
  const corpo = document.getElementById('corpoTabela');
  corpo.innerHTML = '<tr><td colspan="6" class="vazio">Carregando produtos...</td></tr>';
  try {
    const resp = await fetch(ACHADINHOS.planilha_catalogo + '&t=' + Date.now(), {
      method: 'GET', mode: 'cors', cache: 'no-cache'
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    
    let texto = await resp.text();
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    
    produtos = parseCSV(texto);
    renderizarTabela();
  } catch (e) {
    console.error('Erro ao carregar:', e);
    corpo.innerHTML = `<tr><td colspan="6" class="vazio">Erro de conexão: ${e.message}</td></tr>`;
  }
}

function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/);
  if (linhas.length < 2) return [];
  let indiceCabecalho = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].toLowerCase().includes('ativo') && linhas[i].toLowerCase().includes('nome')) {
      indiceCabecalho = i; break;
    }
  }
  if (indiceCabecalho === -1) indiceCabecalho = 0;
  
  const cabecalhos = parseLinhaCSV(linhas[indiceCabecalho]);
  return linhas.slice(indiceCabecalho + 1).filter(l => l.trim().length > 0).map((l, i) => {
    const cols = parseLinhaCSV(l);
    const obj = { _linha: indiceCabecalho + 1 + i + 1 };
    cabecalhos.forEach((h, idx) => { obj[h.trim()] = cols[idx] !== undefined ? cols[idx] : ''; });
    return obj;
  });
}

function parseLinhaCSV(linha) {
  const res = []; let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i], proximo = linha[i + 1];
    if (aspas) {
      if (c === '"' && proximo === '"') { atual += '"'; i++; }
      else if (c === '"') { aspas = false; }
      else { atual += c; }
    } else {
      if (c === '"') { aspas = true; }
      else if (c === ',') { res.push(atual.trim()); atual = ''; }
      else { atual += c; }
    }
  }
  res.push(atual.trim()); return res;
}

function get(p, ...nomes) {
  for (const nome of nomes) {
    for (const chave of Object.keys(p)) {
      if (chave.startsWith('_')) continue;
      const normChave = chave.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const normNome = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      if (normChave === normNome) return p[chave];
    }
  }
  return '';
}

// ✅ CORREÇÃO CRÍTICA: c => em vez de c = >
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderizarTabela() {
  const busca = document.getElementById('busca').value.toLowerCase();
  const filtro = document.getElementById('filtroStatus').value;
  const corpo = document.getElementById('corpoTabela');
  
  const filtrados = produtos.filter(p => {
    const nome = (get(p, 'Nome') || '').toLowerCase();
    const cat = (get(p, 'Categoria') || '').toLowerCase();
    const ativo = get(p, 'Ativo');
    return (!busca || nome.includes(busca) || cat.includes(busca)) && (!filtro || ativo === filtro);
  });

  if (filtrados.length === 0) {
    corpo.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum produto encontrado</td></tr>';
    return;
  }

  corpo.innerHTML = filtrados.map(p => {
    const nome = get(p, 'Nome') || '(sem nome)';
    const img = (get(p, 'Imagem 1', 'Imagem') || '').trim();
    const cat = get(p, 'Categoria') || '-';
    const destaque = get(p, 'Destaque') || 'Não';
    const ativo = get(p, 'Ativo') || 'Sim';
    const imgHtml = img ? `<img src="${escapeHtml(img)}" alt="" onerror="this.style.display='none'">` : '—';
    
    return `<tr>
      <td>${imgHtml}</td>
      <td><strong>${escapeHtml(nome)}</strong></td>
      <td>${escapeHtml(cat)}</td>
      <td><span class="badge badge-${destaque === 'Sim' ? 'destaque' : 'nao'}">${destaque}</span></td>
      <td><span class="badge badge-${ativo === 'Sim' ? 'sim' : 'nao'}">${ativo}</span></td>
      <td class="acoes">
        <button class="btn btn-sm btn-icono" onclick="editar(${p._linha})">✏️</button>
        <button class="btn btn-sm btn-icono" onclick="excluir(${p._linha})">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function abrirModal() { document.getElementById('modal').classList.remove('oculto'); }
function fecharModal() {
  document.getElementById('modal').classList.add('oculto');
  document.getElementById('formProduto').reset();
}
function novoProduto() {
  document.getElementById('modalTitulo').textContent = 'Novo Produto';
  document.getElementById('campoLinha').value = '';
  abrirModal();
}
function editar(linha) {
  const p = produtos.find(x => x._linha === linha);
  if (!p) return;
  document.getElementById('modalTitulo').textContent = 'Editar Produto';
  document.getElementById('campoLinha').value = linha;
  document.getElementById('nome').value = get(p, 'Nome');
  document.getElementById('tipo').value = get(p, 'Tipo');
  document.getElementById('plataforma').value = get(p, 'Plataforma');
  document.getElementById('categoria').value = get(p, 'Categoria');
  document.getElementById('subcategoria').value = get(p, 'Subcategoria');
  document.getElementById('validade').value = get(p, 'Validade da oferta');
  document.getElementById('link').value = get(p, 'Link de Afiliado', 'Link');
  document.getElementById('imagem1').value = get(p, 'Imagem 1', 'Imagem');
  document.getElementById('ordem').value = get(p, 'Ordem') || '0';
  document.getElementById('destaque').value = get(p, 'Destaque') || 'Não';
  document.getElementById('ativo').value = get(p, 'Ativo') || 'Sim';
  abrirModal();
}

// ✅ SALVAR CORRIGIDO (Sem campos removidos e com tratamento de erro robusto)
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
    'Validade da oferta': document.getElementById('validade').value.trim(),
    'Link de Afiliado': document.getElementById('link').value.trim(),
    'Imagem 1': document.getElementById('imagem1').value.trim(),
    'Ordem': document.getElementById('ordem').value.trim(),
    'Destaque': document.getElementById('destaque').value // ✅ Agora será salvo corretamente
  };

  const dados = { acao: linha ? 'editar' : 'novo', linha: linha ? parseInt(linha) : null, produto };

  try {
    toast('💾 Salvando...', '');
    const urlEnvio = `${URL_GRAVAR_PRODUTOS}?data=${encodeURIComponent(JSON.stringify(dados))}`;
    const resp = await fetch(urlEnvio, { method: 'GET' });
    const texto = await resp.text();
    
    let resJson;
    try { resJson = JSON.parse(texto); } 
    catch (err) { 
      console.error('Resposta não é JSON:', texto);
      toast('❌ Servidor retornou erro HTML. Verifique o Apps Script.', 'erro'); 
      return; 
    }

    if (resJson.ok) {
      toast('✅ ' + resJson.msg, 'sucesso');
      fecharModal();
      setTimeout(carregarProdutos, 1500);
    } else {
      toast('❌ Erro: ' + resJson.msg, 'erro');
    }
  } catch (err) {
    console.error(err);
    toast('❌ Erro de conexão: ' + err.message, 'erro');
  }
});

async function excluir(linha) {
  const p = produtos.find(x => x._linha === linha);
  if (!confirm(`Deseja realmente excluir "${get(p, 'Nome') || 'este produto'}"?`)) return;
  try {
    toast('Excluindo...', '');
    const dados = { acao: 'excluir', linha: linha };
    const urlEnvio = `${URL_GRAVAR_PRODUTOS}?data=${encodeURIComponent(JSON.stringify(dados))}`;
    const resp = await fetch(urlEnvio, { method: 'GET' });
    const texto = await resp.text();
    let resJson;
    try { resJson = JSON.parse(texto); } catch { return toast('❌ Erro no servidor', 'erro'); }
    
    if (resJson.ok) {
      toast('✅ Excluído!', 'sucesso');
      setTimeout(carregarProdutos, 1500);
    } else {
      toast('❌ Erro: ' + resJson.msg, 'erro');
    }
  } catch (err) {
    toast('❌ Erro de conexão', 'erro');
  }
}

function toast(msg, tipo) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (tipo || '');
  setTimeout(() => t.classList.add('oculto'), 3500);
}

document.getElementById('btnNovo').onclick = novoProduto;
document.getElementById('btnRecarregar').onclick = carregarProdutos;
document.getElementById('busca').oninput = renderizarTabela;
document.getElementById('filtroStatus').onchange = renderizarTabela;

carregarProdutos();
