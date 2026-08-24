const URL_GRAVAR_PRODUTOS = ACHADINHOS.registrar_cliques;
let produtos = [];
let produtoEditando = null;
let linhasSelecionadas = new Set();
let linhasPendentesExclusao = [];

// ============ CARREGAR ============
async function carregarProdutos() {
  const corpo = document.getElementById('corpoTabela');
  corpo.innerHTML = '<tr><td colspan="7" class="vazio">Carregando produtos...</td></tr>';
  try {
    const resp = await fetch(ACHADINHOS.planilha_catalogo + '&t=' + Date.now(), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    if (!resp.ok) {
      corpo.innerHTML = `<tr><td colspan="7" class="vazio">Erro HTTP ${resp.status} ao carregar planilha.</td></tr>`;
      return;
    }
    let texto = await resp.text();
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    produtos = parseCSV(texto);
    linhasSelecionadas.clear();
    atualizarCheckboxTodos();
    renderizarTabela();
  } catch (e) {
    console.error('Erro ao carregar:', e);
    corpo.innerHTML = `<tr><td colspan="7" class="vazio">Erro de conexão: ${e.message}</td></tr>`;
  }
}

// ============ PARSER CSV ============
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
      if (c === '"' && proximo === '"') { atual += '"'; i++; }
      else if (c === '"') { aspas = false; }
      else { atual += c; }
    } else {
      if (c === '"') { aspas = true; }
      else if (c === ',') { res.push(atual.trim()); atual = ''; }
      else { atual += c; }
    }
  }
  res.push(atual.trim());
  return res;
}

// ============ BUSCA NORMALIZADA ============
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

// ============ ESCAPE HTML (CORRIGIDO - SEM BUG DE SINTAXE) ============
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// ============ CHECKBOXES ============
function toggleTodos() {
  const checkboxTodos = document.getElementById('checkboxTodos');
  const checkboxes = document.querySelectorAll('.checkbox-produto');
  if (checkboxTodos.checked) {
    checkboxes.forEach(cb => {
      cb.checked = true;
      linhasSelecionadas.add(parseInt(cb.dataset.linha));
    });
  } else {
    checkboxes.forEach(cb => {
      cb.checked = false;
      linhasSelecionadas.delete(parseInt(cb.dataset.linha));
    });
  }
  atualizarContador();
}

function toggleSelecao(linha) {
  if (linhasSelecionadas.has(linha)) {
    linhasSelecionadas.delete(linha);
  } else {
    linhasSelecionadas.add(linha);
  }
  atualizarContador();
  atualizarCheckboxTodos();
}

function atualizarCheckboxTodos() {
  const checkboxTodos = document.getElementById('checkboxTodos');
  const checkboxes = document.querySelectorAll('.checkbox-produto');
  const todosMarcados = checkboxes.length > 0 &&
    Array.from(checkboxes).every(cb => cb.checked);
  checkboxTodos.checked = todosMarcados;
}

function atualizarContador() {
  const contador = document.getElementById('contadorSelecionados');
  const btnExcluir = document.getElementById('btnExcluirSelecionados');
  const numSelecionados = document.getElementById('numSelecionados');
  const total = linhasSelecionadas.size;
  numSelecionados.textContent = total;
  if (total > 0) {
    contador.classList.add('visivel');
    btnExcluir.classList.add('visivel');
  } else {
    contador.classList.remove('visivel');
    btnExcluir.classList.remove('visivel');
  }
}

// ============ MODAL DE CONFIRMAÇÃO ============
function abrirConfirmacaoExclusao(linhas) {
  linhasPendentesExclusao = linhas;
  const qtdEl = document.getElementById('qtdExcluir');
  const listaEl = document.getElementById('listaProdutosExcluir');
  const btnConfirmar = document.getElementById('btnConfirmarExcluir');
  qtdEl.textContent = linhas.length;
  const maxExibir = 5;
  let html = '<ul>';
  linhas.slice(0, maxExibir).forEach(linha => {
    const p = produtos.find(x => x._linha === linha);
    const nome = p ? (get(p, 'Nome') || 'Produto sem nome') : 'Produto desconhecido';
    const cat = p ? (get(p, 'Categoria') || '') : '';
    const catHtml = cat ? `<span style="color:#888;font-size:0.75rem;margin-left:4px;">(${escapeHtml(cat)})</span>` : '';
    html += `<li><i class="fas fa-times-circle"></i> ${escapeHtml(nome)}${catHtml}</li>`;
  });
  if (linhas.length > maxExibir) {
    html += `<li class="mais-itens">... e mais ${linhas.length - maxExibir} produto(s)</li>`;
  }
  html += '</ul>';
  listaEl.innerHTML = html;
  btnConfirmar.disabled = false;
  btnConfirmar.innerHTML = '<i class="fas fa-trash-alt"></i> Sim, excluir tudo';
  document.getElementById('modalConfirmacao').classList.remove('oculto');
}

function fecharConfirmacao() {
  document.getElementById('modalConfirmacao').classList.add('oculto');
  linhasPendentesExclusao = [];
}

async function confirmarExclusao() {
  const btnConfirmar = document.getElementById('btnConfirmarExcluir');
  btnConfirmar.disabled = true;
  btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
  const linhas = linhasPendentesExclusao;
  let sucesso = 0;
  let erros = 0;
  for (const linha of linhas) {
    try {
      const dados = { acao: 'excluir', linha: linha };
      const urlEnvio = `${URL_GRAVAR_PRODUTOS}?data=${encodeURIComponent(JSON.stringify(dados))}`;
      const resp = await fetch(urlEnvio, { method: 'GET' });
      const texto = await resp.text();
      let resJson;
      try {
        resJson = JSON.parse(texto);
      } catch {
        console.error('Resposta não é JSON:', texto);
        erros++;
        continue;
      }
      if (resJson.ok) sucesso++; else erros++;
    } catch (err) {
      console.error('Erro ao excluir linha', linha, err);
      erros++;
    }
  }
  fecharConfirmacao();
  if (sucesso > 0) {
    toast(`✅ ${sucesso} produto(s) excluído(s)!`, 'sucesso');
    linhasSelecionadas.clear();
    atualizarContador();
    setTimeout(carregarProdutos, 1500);
  } else {
    toast('❌ Erro ao excluir produtos', 'erro');
  }
}

function excluirSelecionados() {
  if (linhasSelecionadas.size === 0) {
    toast('⚠️ Nenhum produto selecionado', 'erro');
    return;
  }
  abrirConfirmacaoExclusao(Array.from(linhasSelecionadas));
}

// ============ RENDERIZAR TABELA ============
function renderizarTabela() {
  const busca = document.getElementById('busca').value.toLowerCase();
  const filtro = document.getElementById('filtroStatus').value;
  const corpo = document.getElementById('corpoTabela');
  const filtrados = produtos.filter(p => {
    const nome = (get(p, 'Nome') || '').toLowerCase();
    const cat = (get(p, 'Categoria') || '').toLowerCase();
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
    const img = (get(p, 'Imagem 1', 'Imagem') || '').trim();
    const cat = get(p, 'Categoria') || '-';
    const destaque = get(p, 'Destaque') || 'Não';
    const ativo = get(p, 'Ativo') || 'Sim';
    const selecionado = linhasSelecionadas.has(p._linha) ? 'checked' : '';
    const imgHtml = img
      ? `<img src="${escapeHtml(img)}" alt="" onerror="this.style.display='none'">`
      : '—';
    return `
      <tr>
        <td>
          <input type="checkbox"
                 class="checkbox-produto"
                 data-linha="${p._linha}"
                 ${selecionado}
                 onchange="toggleSelecao(${p._linha})">
        </td>
        <td>${imgHtml}</td>
        <td><strong>${escapeHtml(nome)}</strong></td>
        <td>${escapeHtml(cat)}</td>
        <td><span class="badge badge-${destaque === 'Sim' ? 'destaque' : 'nao'}">${destaque}</span></td>
        <td><span class="badge badge-${ativo === 'Sim' ? 'sim' : 'nao'}">${ativo}</span></td>
        <td class="acoes">
          <button class="btn btn-sm btn-icono" title="Editar" onclick="editar(${p._linha})">✏️</button>
          <button class="btn btn-sm btn-icono" title="Excluir" onclick="excluir(${p._linha})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ============ MODAL DE EDIÇÃO ============
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
  document.getElementById('ativo').value = get(p, 'Ativo') || 'Sim';
  document.getElementById('tipo').value = get(p, 'Tipo');
  document.getElementById('plataforma').value = get(p, 'Plataforma');
  document.getElementById('categoria').value = get(p, 'Categoria');
  document.getElementById('subcategoria').value = get(p, 'Subcategoria');
   document.getElementById('nome').value = get(p, 'Nome');
  document.getElementById('validade').value = get(p, 'Validade da oferta');
  document.getElementById('link').value = get(p, 'Link de Afiliado', 'Link');
  document.getElementById('imagem1').value = get(p, 'Imagem 1', 'Imagem');
  document.getElementById('ordem').value = get(p, 'Ordem') || '0';
  document.getElementById('destaque').value = get(p, 'Destaque') || 'Não';

  abrirModal();
}

// ============ SALVAR (COM TRATAMENTO ROBUSTO DE ERRO) ============
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
    'Destaque': document.getElementById('destaque').value,
  };

  const dados = {
    acao: linha ? 'editar' : 'novo',
    linha: linha ? parseInt(linha) : null,
    produto: produto
  };

  console.log(' Enviando dados:', dados);

  try {
    toast('💾 Salvando alterações...', '');

    const urlEnvio = `${URL_GRAVAR_PRODUTOS}?data=${encodeURIComponent(JSON.stringify(dados))}`;
    console.log('🔗 URL:', urlEnvio);

    const resp = await fetch(urlEnvio, { method: 'GET' });

    console.log('📥 Status:', resp.status, resp.statusText);

    const texto = await resp.text();
    console.log('📥 Resposta bruta:', texto);

    let resJson;
    try {
      resJson = JSON.parse(texto);
    } catch (parseErr) {
      console.error('❌ Resposta não é JSON válido:', texto);
      toast('❌ Servidor retornou resposta inválida. Verifique o Apps Script.', 'erro');
      return;
    }

    if (resJson.ok) {
      toast('✅ ' + (resJson.msg || 'Salvo com sucesso!'), 'sucesso');
      fecharModal();
      setTimeout(carregarProdutos, 1500);
    } else {
      toast(' Erro: ' + (resJson.msg || 'Desconhecido'), 'erro');
    }
  } catch (err) {
    console.error('❌ Erro completo:', err);
    toast('❌ Erro de conexão: ' + err.message, 'erro');
  }
});

// ============ EXCLUIR ÚNICO ============
function excluir(linha) {
  const p = produtos.find(x => x._linha === linha);
  if (!p) return;
  abrirConfirmacaoExclusao([linha]);
}

// ============ TOAST ============
function toast(msg, tipo) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (tipo || '');
  setTimeout(() => t.classList.add('oculto'), 3500);
}

// ============ EVENTOS ============
document.getElementById('btnNovo').onclick = novoProduto;
document.getElementById('btnRecarregar').onclick = carregarProdutos;
document.getElementById('busca').oninput = renderizarTabela;
document.getElementById('filtroStatus').onchange = renderizarTabela;

document.getElementById('modalConfirmacao').addEventListener('click', function(e) {
  if (e.target === this) fecharConfirmacao();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    fecharConfirmacao();
    fecharModal();
  }
});

carregarProdutos();
