const URL_GRAVAR_PRODUTOS = ACHADINHOS.registrar_cliques;

let produtos = [];
let produtoEditando = null;

// ============ CARREGAR ============
async function carregarProdutos() {
  const corpo = document.getElementById('corpoTabela');
  corpo.innerHTML = '<tr><td colspan="6" class="vazio">Carregando produtos...</td></tr>';

  try {
    const resp = await fetch(ACHADINHOS.planilha_catalogo + '&t=' + Date.now(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });

    if (!resp.ok) {
      corpo.innerHTML = `<tr><td colspan="6" class="vazio">Erro HTTP ${resp.status} ao carregar planilha.</td></tr>`;
      return;
    }

    let texto = await resp.text();
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);

    produtos = parseCSV(texto);
    renderizarTabela();
  } catch (e) {
    console.error('Erro:', e);
    corpo.innerHTML = `<tr><td colspan="6" class="vazio">Erro de conexão.</td></tr>`;
  }
}

// ============ PARSER CSV INTELIGENTE ============
function parseCSV(texto) {
  const linhas = texto.split(/\r?\n/);
  if (linhas.length < 2) return [];

  let indiceCabecalho = -1;
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].toLowerCase();
    if (l.includes('ativo') && l.includes('nome')) {
      indiceCabecalho = i;
      break;
    }
  }

  if (indiceCabecalho === -1) indiceCabecalho = 0;
  const cabecalhos = parseLinhaCSV(linhas[indiceCabecalho]);

  return linhas.slice(indiceCabecalho + 1)
    .filter(l => l.trim().length > 0)
    .map((l, i) => {
      const cols = parseLinhaCSV(l);
      const obj = { _linha: indiceCabecalho + 1 + i + 1 };
      cabecalhos.forEach((h, idx) => {
        obj[h.trim()] = cols[idx] !== undefined ? cols[idx] : '';
      });
      return obj;
    });
}

function parseLinhaCSV(linha) {
  const res = [];
  let atual = '';
  let aspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    const proximo = linha[i + 1];

    if (aspas) {
      if (c === '"' && proximo === '"') {
        atual += '"';
        i++;
      } else if (c === '"') {
        aspas = false;
      } else {
        atual += c;
      }
    } else {
      if (c === '"') {
        aspas = true;
      } else if (c === ',') {
        res.push(atual.trim());
        atual = '';
      } else {
        atual += c;
      }
    }
  }
  res.push(atual.trim());
  return res;
}

// Função universal para buscar propriedades ignorando maiúsculas/acentos
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

// ============ RENDERIZAR TABELA ============
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
    corpo.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum produto encontrado</td></tr>';
    return;
  }

  corpo.innerHTML = filtrados.map(p => {
    const nome = get(p, 'Nome') || '(sem nome)';
    const img = get(p, 'Imagem 1', 'Imagem') || '';
    const cat = get(p, 'Categoria') || '-';
    const destaque = get(p, 'Destaque') || 'Não';
    const ativo = get(p, 'Ativo') || 'Sim';

    return `
      <tr>
        <td>${img ? `<img src="${img}" alt="" onerror="this.style.display='none'">` : '—'}</td>
        <td><strong>${escapeHtml(nome)}</strong></td>
        <td>${escapeHtml(cat)}</td>
        <td><span class="badge badge-${destaque === 'Sim' ? 'destaque' : 'nao'}">${destaque}</span></td>
        <td><span class="badge badge-${ativo === 'Sim' ? 'sim' : 'nao'}">${ativo}</span></td>
        <td class="acoes">
          <button class="btn btn-sm btn-icono" title="Editar produto" onclick="editar(${p._linha})">✏️</button>
          <button class="btn btn-sm btn-icono" title="Excluir produto" onclick="excluir(${p._linha})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
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

  document.getElementById('nome').value = get(p, 'Nome');
  document.getElementById('tipo').value = get(p, 'Tipo');
  document.getElementById('plataforma').value = get(p, 'Plataforma');
  document.getElementById('categoria').value = get(p, 'Categoria');
  document.getElementById('subcategoria').value = get(p, 'Subcategoria');
  document.getElementById('validade').value = get(p, 'Validade da oferta');
  document.getElementById('link').value = get(p, 'Link de Afiliado', 'Link');
  document.getElementById('textoBotao').value = get(p, 'Texto do Botão');
  document.getElementById('imagem1').value = get(p, 'Imagem 1', 'Imagem');
  document.getElementById('imagem2').value = get(p, 'Imagem 2');
  document.getElementById('imagem3').value = get(p, 'Imagem 3');
  document.getElementById('imagem4').value = get(p, 'Imagem 4');
  document.getElementById('ordem').value = get(p, 'Ordem');
  document.getElementById('destaque').value = get(p, 'Destaque') || 'Não';
  document.getElementById('ativo').value = get(p, 'Ativo') || 'Sim';

  abrirModal();
}

// ============ SALVAR (VIA GET PARA EVITAR CORS) ============
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
    'Texto do Botão': document.getElementById('textoBotao').value.trim(),
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
    toast('Salvando alterações...', '');
    const urlEnvio = `${URL_GRAVAR_PRODUTOS}?data=${encodeURIComponent(JSON.stringify(dados))}`;
    
    const resp = await fetch(urlEnvio, { method: 'GET' });
    const resJson = await resp.json();

    if (resJson.ok) {
      toast('✅ ' + resJson.msg, 'sucesso');
      fecharModal();
      setTimeout(carregarProdutos, 1500);
    } else {
      toast('❌ Erro: ' + resJson.msg, 'erro');
    }
  } catch (err) {
    console.error(err);
    toast('❌ Erro ao salvar dados.', 'erro');
  }
});

// ============ EXCLUIR ============
async function excluir(linha) {
  const p = produtos.find(x => x._linha === linha);
  const nomeProduto = p ? (get(p, 'Nome') || 'este produto') : 'este produto';

  if (!confirm(`Deseja realmente excluir:\n\n"${nomeProduto}"?`)) return;

  try {
    toast('Excluindo...', '');
    const dados = { acao: 'excluir', linha: linha };
    const urlEnvio = `${URL_GRAVAR_PRODUTOS}?data=${encodeURIComponent(JSON.stringify(dados))}`;
    
    const resp = await fetch(urlEnvio, { method: 'GET' });
    const resJson = await resp.json();

    if (resJson.ok) {
      toast('✅ Excluído com sucesso!', 'sucesso');
      setTimeout(carregarProdutos, 1500);
    } else {
      toast('❌ Erro ao excluir', 'erro');
    }
  } catch (err) {
    toast('❌ Erro de conexão.', 'erro');
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
