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
    corpo.innerHTML = `<tr><td colspan="6" class="vazio">Erro: ${e.message}</td></tr>`;
  }
}

function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/);
  if (linhas.length < 2) return [];
  let idx = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].toLowerCase().includes('ativo') && linhas[i].toLowerCase().includes('nome')) {
      idx = i; break;
    }
  }
  if (idx === -1) idx = 0;
  const cabecalhos = parseLinhaCSV(linhas[idx]);
  return linhas.slice(idx + 1).filter(l => l.trim()).map((l, i) => {
    const cols = parseLinhaCSV(l);
    const obj = { _linha: idx + 2 + i };
    cabecalhos.forEach((h, c) => { obj[h.trim()] = cols[c] || ''; });
    return obj;
  });
}

function parseLinhaCSV(linha) {
  const res = []; let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i], prox = linha[i+1];
    if (aspas) {
      if (c === '"' && prox === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else {
      if (c === '"') aspas = true;
      else if (c === ',') { res.push(atual.trim()); atual = ''; }
      else atual += c;
    }
  }
  res.push(atual.trim()); return res;
}

function get(p, ...nomes) {
  for (const nome of nomes) {
    for (const chave of Object.keys(p)) {
      if (chave.startsWith('_')) continue;
      const nChave = chave.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const nNome = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      if (nChave === nNome) return p[chave];
    }
  }
  return '';
}

// ✅ ESCAPE HTML CORRIGIDO (SEM ERRO DE SINTAXE)
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function renderizarTabela() {
  const busca = (document.getElementById('busca').value || '').toLowerCase();
  const filtro = document.getElementById('filtroStatus').value;
  const corpo = document.getElementById('corpoTabela');
  
  const filtrados = produtos.filter(p => {
    const nome = (get(p, 'Nome') || '').toLowerCase();
    const cat = (get(p, 'Categoria') || '').toLowerCase();
    const ativo = get(p, 'Ativo');
    return (!busca || nome.includes(busca) || cat.includes(busca)) && 
           (!filtro || ativo === filtro);
  });

  if (!filtrados.length) {
    corpo.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum produto encontrado</td></tr>';
    return;
  }

  corpo.innerHTML = filtrados.map(p => {
    const nome = get(p, 'Nome') || 'Sem nome';
    const img = (get(p, 'Imagem 1') || get(p, 'Imagem') || '').trim();
    const cat = get(p, 'Categoria') || '-';
    const destaque = get(p, 'Destaque') || 'Não';
    const ativo = get(p, 'Ativo') || 'Sim';
    
    return `<tr>
      <td>${img ? `<img src="${escapeHtml(img)}" onerror="this.style.display='none'">` : '—'}</td>
      <td><strong>${escapeHtml(nome)}</strong></td>
      <td>${escapeHtml(cat)}</td>
      <td><span class="badge badge-${destaque==='Sim'?'destaque':'nao'}">${destaque}</span></td>
      <td><span class="badge badge-${ativo==='Sim'?'sim':'nao'}">${ativo}</span></td>
      <td class="acoes">
        <button class="btn btn-sm btn-icono" onclick="editar(${p._linha})" style="cursor:pointer">✏️</button>
        <button class="btn btn-sm btn-icono" onclick="excluir(${p._linha})" style="cursor:pointer">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function abrirModal() { document.getElementById('modal').classList.remove('oculto'); }
function fecharModal() {
  document.getElementById('modal').classList.add('oculto');
  document.getElementById('formProduto').reset();
}

function editar(linha) {
  const p = produtos.find(x => x._linha === linha);
  if (!p) { alert('Produto não encontrado'); return; }
  
  document.getElementById('modalTitulo').textContent = 'Editar Produto';
  document.getElementById('campoLinha').value = linha;
  document.getElementById('ativo').value = get(p, 'Ativo') || 'Sim';
  document.getElementById('tipo').value = get(p, 'Tipo') || '';
  document.getElementById('plataforma').value = get(p, 'Plataforma') || '';
  document.getElementById('categoria').value = get(p, 'Categoria') || '';
  document.getElementById('subcategoria').value = get(p, 'Subcategoria') || '';
  document.getElementById('nome').value = get(p, 'Nome') || '';
  document.getElementById('validade').value = get(p, 'Validade da oferta') || '';
  document.getElementById('link').value = get(p, 'Link de Afiliado') || '';
  document.getElementById('imagem1').value = get(p, 'Imagem 1') || '';
  document.getElementById('ordem').value = get(p, 'Ordem') || '0';
  document.getElementById('destaque').value = get(p, 'Destaque') || 'Não';
  
  abrirModal();
}

// ✅ SALVAR (APENAS CAMPOS EXISTENTES)
document.getElementById('formProduto').onsubmit = async (e) => {
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
    'Destaque': document.getElementById('destaque').value
  };
  
  const dados = { acao: linha ? 'editar' : 'novo', linha: linha ? +linha : null, produto };
  
  try {
    toast('Salvando...');
    const url = `${URL_GRAVAR_PRODUTOS}?data=${encodeURIComponent(JSON.stringify(dados))}`;
    const resp = await fetch(url, { method: 'GET' });
    const texto = await resp.text();
    
    let json;
    try { json = JSON.parse(texto); } catch {
      toast('Erro: resposta inválida', 'erro'); 
      console.error('Resposta:', texto);
      return;
    }
    
    if (json.ok) { 
      toast('Salvo!', 'sucesso'); 
      fecharModal(); 
      setTimeout(carregarProdutos, 1500); 
    } else { 
      toast('Erro: ' + json.msg, 'erro'); 
    }
  } catch (err) { 
    toast('Erro: ' + err.message, 'erro'); 
    console.error(err);
  }
};

async function excluir(linha) {
  const p = produtos.find(x => x._linha === linha);
  if (!confirm(`Excluir "${get(p,'Nome')}"?`)) return;
  try {
    toast('Excluindo...');
    const url = `${URL_GRAVAR_PRODUTOS}?data=${encodeURIComponent(JSON.stringify({acao:'excluir',linha}))}`;
    const resp = await fetch(url, { method: 'GET' });
    const texto = await resp.text();
    let json;
    try { json = JSON.parse(texto); } catch { toast('Erro na resposta', 'erro'); return; }
    if (json.ok) { toast('Excluído!', 'sucesso'); setTimeout(carregarProdutos, 1500); }
    else toast('Erro: ' + json.msg, 'erro');
  } catch (err) { toast('Erro: ' + err.message, 'erro'); }
}

function toast(msg, tipo='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + tipo;
  setTimeout(() => t.classList.add('oculto'), 3000);
}

document.getElementById('btnNovo').onclick = () => {
  document.getElementById('modalTitulo').textContent = 'Novo Produto';
  document.getElementById('formProduto').reset();
  document.getElementById('campoLinha').value = '';
  abrirModal();
};
document.getElementById('btnRecarregar').onclick = carregarProdutos;
document.getElementById('busca').oninput = renderizarTabela;
document.getElementById('filtroStatus').onchange = renderizarTabela;

carregarProdutos();
