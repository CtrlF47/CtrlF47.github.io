const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const DB_PATH = path.join(__dirname, 'medlaudo.db');
const db = new sqlite3.Database(DB_PATH);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDatabase() {
  await run(`CREATE TABLE IF NOT EXISTS medico (
    user TEXT PRIMARY KEY,
    senha TEXT NOT NULL,
    nome TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS empresas (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    cnpj TEXT,
    user TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS laudos (
    id TEXT PRIMARY KEY,
    paciente TEXT NOT NULL,
    cpf TEXT,
    empresaId TEXT,
    tipo TEXT,
    data TEXT,
    resultado TEXT,
    cid TEXT,
    obs TEXT,
    arquivo TEXT,
    medico TEXT,
    FOREIGN KEY(empresaId) REFERENCES empresas(id)
  )`);

  const medicoCount = await get('SELECT COUNT(*) AS count FROM medico');
  if (!medicoCount || medicoCount.count === 0) {
    await run('INSERT INTO medico(user, senha, nome) VALUES (?, ?, ?)', ['medico', 'medico123', 'Dr. Henrique Souza']);
  }

  const empresasCount = await get('SELECT COUNT(*) AS count FROM empresas');
  if (!empresasCount || empresasCount.count === 0) {
    await run('INSERT INTO empresas(id, nome, cnpj, user, senha) VALUES (?, ?, ?, ?, ?)', ['emp1', 'Metalúrgica São Paulo Ltda', '12.345.678/0001-90', 'metalsp', '1234']);
    await run('INSERT INTO empresas(id, nome, cnpj, user, senha) VALUES (?, ?, ?, ?, ?)', ['emp2', 'Construtora Norte S.A.', '98.765.432/0001-10', 'contnorte', '1234']);
    await run('INSERT INTO empresas(id, nome, cnpj, user, senha) VALUES (?, ?, ?, ?, ?)', ['emp3', 'Agro Pernambuco Ltda', '55.123.456/0001-77', 'agro_pe', '1234']);
  }

  const laudosCount = await get('SELECT COUNT(*) AS count FROM laudos');
  if (!laudosCount || laudosCount.count === 0) {
    await run(`INSERT INTO laudos(id, paciente, cpf, empresaId, tipo, data, resultado, cid, obs, arquivo, medico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['l1', 'Carlos Eduardo Silva', '012.345.678-90', 'emp1', 'Admissional', '2025-03-10', 'Apto', '', 'Paciente sem restrições.', null, 'Dr. Henrique Souza']);
    await run(`INSERT INTO laudos(id, paciente, cpf, empresaId, tipo, data, resultado, cid, obs, arquivo, medico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['l2', 'Maria Aparecida Ferreira', '987.654.321-00', 'emp1', 'Periódico', '2025-02-18', 'Apto com restrição', 'M54.5', 'Restrição para cargas acima de 10kg.', null, 'Dr. Henrique Souza']);
    await run(`INSERT INTO laudos(id, paciente, cpf, empresaId, tipo, data, resultado, cid, obs, arquivo, medico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['l3', 'João Ricardo Alves', '111.222.333-44', 'emp2', 'Demissional', '2025-03-22', 'Apto', '', 'Exame de saída sem pendências.', null, 'Dr. Henrique Souza']);
    await run(`INSERT INTO laudos(id, paciente, cpf, empresaId, tipo, data, resultado, cid, obs, arquivo, medico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['l4', 'Fernanda Lima Costa', '555.666.777-88', 'emp3', 'Admissional', '2025-04-01', 'Inapto', 'Z73.0', 'Encaminhada para especialista.', null, 'Dr. Henrique Souza']);
    await run(`INSERT INTO laudos(id, paciente, cpf, empresaId, tipo, data, resultado, cid, obs, arquivo, medico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['l5', 'Roberto Nunes Pereira', '222.333.444-55', 'emp2', 'Retorno ao Trabalho', '2025-03-30', 'Apto', '', 'Retorno sem restrições após afastamento.', null, 'Dr. Henrique Souza']);
  }
}

app.post('/api/login', async (req, res) => {
  const { role, user, senha } = req.body;
  if (!role || !user || !senha) {
    return res.status(400).json({ error: 'Dados de login incompletos.' });
  }

  try {
    if (role === 'medico') {
      const medico = await get('SELECT nome FROM medico WHERE user = ? AND senha = ?', [user, senha]);
      if (!medico) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      return res.json({ role: 'medico', nome: medico.nome });
    }

    const empresa = await get('SELECT id, nome FROM empresas WHERE user = ? AND senha = ?', [user, senha]);
    if (!empresa) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    return res.json({ role: 'empresa', id: empresa.id, nome: empresa.nome });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/state', async (req, res) => {
  try {
    const empresas = await all('SELECT id, nome, cnpj, user FROM empresas ORDER BY nome');
    const laudos = await all('SELECT * FROM laudos ORDER BY data DESC');
    const medico = await get('SELECT nome FROM medico LIMIT 1');
    res.json({ empresas, laudos, medico: { nome: medico?.nome || '' } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/empresas', async (req, res) => {
  try {
    const empresas = await all('SELECT id, nome, cnpj, user FROM empresas ORDER BY nome');
    res.json(empresas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/empresas', async (req, res) => {
  const { nome, cnpj, user, senha } = req.body;
  if (!nome || !user || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios estão faltando.' });
  }

  try {
    await run('INSERT INTO empresas(id, nome, cnpj, user, senha) VALUES (?, ?, ?, ?, ?)', [
      'emp' + Date.now(), nome, cnpj || '', user, senha,
    ]);
    res.status(201).json({ success: true });
  } catch (error) {
    if (error.message.includes('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'Este usuário já está em uso.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/laudos', async (req, res) => {
  try {
    const empresaId = req.query.empresaId;
    const sql = empresaId ? 'SELECT * FROM laudos WHERE empresaId = ? ORDER BY data DESC' : 'SELECT * FROM laudos ORDER BY data DESC';
    const laudos = await all(sql, empresaId ? [empresaId] : []);
    res.json(laudos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/laudos', async (req, res) => {
  const { paciente, cpf, empresaId, tipo, data, resultado, cid, obs, arquivo, medico } = req.body;
  if (!paciente || !empresaId || !tipo || !data || !resultado || !medico) {
    return res.status(400).json({ error: 'Campos obrigatórios estão faltando.' });
  }

  try {
    const id = 'l' + Date.now();
    await run(`INSERT INTO laudos(id, paciente, cpf, empresaId, tipo, data, resultado, cid, obs, arquivo, medico)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, paciente, cpf || '', empresaId, tipo, data, resultado, cid || '', obs || '', arquivo || null, medico,
    ]);
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/laudos/:id', async (req, res) => {
  try {
    await run('DELETE FROM laudos WHERE id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).send('Página não encontrada');
});

initDatabase()
  .then(() => {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Servidor iniciado em http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Erro ao inicializar banco de dados:', error);
    process.exit(1);
  });
