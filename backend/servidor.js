global.fetch = require("node-fetch");

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
const nano = require("nano")("http://admin:123@localhost:5984");

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + "/public"));

const SECRET = "segredo";

// conexão CouchDB

var listaBancos;

// usuários fictícios
const professores = [
  {
    id: "fabio",
    email: "fabio@ufsc.br",
    senha: "123",
    disciplinas: ["dec0007", "dec0020", "dec0040"],
  },
  {
    id: "joao",
    email: "joao@ufsc.br",
    senha: "123",
    disciplinas: ["dec0001", "dec0002", "dec0003", "dec0020"],
  },
];

const dec0007 = [
  { aluno: "Ana maria", aulas: [] },
  { aluno: "pedro", aulas: [] },
  { aluno: "cintia", aulas: [] },
];
const dec0020 = [
  { aluno: "Ana maria", aulas: [] },
  { aluno: "pedro", aulas: [] },
  { aluno: "cintua", aulas: [] },
];
const semestre = [
  { disciplina: "dec0007", dados: dec0007 },
  { disciplina: "dec0020", dados: dec0020 },
];

async function criaBD(nomeBanco) {
  try {
    if (listaBancos.includes(nomeBanco)) {
      console.log(`O banco de dados "${nomeBanco}" já existe.`);
    } else {
      console.log(`O banco "${nomeBanco}" não existe. Criando agora...`);
      await nano.db.create(nomeBanco);
      console.log("Banco de dados criado com sucesso!");
    }
  } catch (error) {
    console.error("Erro ao verificar banco:", error.message);
  }
}

async function criaTodosBancosDados() {
  listaBancos = await nano.db.list();

  for (let a = 0; a < professores.length; a++) {
    let lista = professores[a].disciplinas;
    for (let b = 0; b < lista.length; b++) {
      await criaBD(lista[b]);
    }
  }
}

// LOGIN

app.post("/login", (req, res) => {
  const { email, senha } = req.body;

  const prof = professores.find((p) => p.email === email && p.senha === senha);

  if (!prof) {
    return res.status(401).send("Login inválido");
  }

  const token = jwt.sign(
    {
      id: prof.id,
    },
    SECRET
  );
  res.json({ token });
});

// middleware autenticação
function autenticar(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).send("Sem token");
  }

  const token = auth.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    console.log(decoded.id);
    req.usuario = decoded.id;

    next();
  } catch {
    res.status(401).send("Token inválido");
  }
}

// sincronização
app.get("/init", async (req, res) => {
  // deve ser chamada para precriar os bancos de dados
  await criaTodosBancosDados();
  res.end();
});

function retornaListaDisciplinas(nome) {
  for (let a = 0; a < professores.length; a++) {
    if (nome == professores[a].id) {
      return professores[a].disciplinas;
    }
  }
  return [];
}
function dadosDiscplina(nome) {
  for (let a = 0; a < semestre.length; a++) {
    if (nome == semestre[a].disciplina) {
      return semestre[a].dados;
    }
  }
  return [];
}
// Professor pergunta sua lista de discplinas
app.get("/disciplinas", autenticar, (req, res) => {
  res.send(retornaListaDisciplinas(req.usuario));
});

// Professor pergunta informacoes sobre 1 disciplina
app.get("/disciplinas/:disciplina", autenticar, (req, res) => {
  const disciplina = req.params.disciplina; //
  let x = dadosDiscplina(disciplina);
  res.send(x);
});

// professor sincroniza uma disciplina
app.post("/sync/:disciplina", autenticar, async (req, res) => {
  const disciplina = req.params.disciplina;
  const disciplinas = retornaListaDisciplinas(req.usuario);

  if (!disciplinas.includes(disciplina)) {
    return res.status(403).send("Professor sem acesso a esta disciplina");
  }

  try {
    const db = nano.use(disciplina);
    const docs = req.body.docs;

    for (const doc of docs) {
      try {
        // 1. Tenta buscar o documento no CouchDB para ver se ele já existe
        const docExistente = await db.get(doc._id);
        // 2. Se existia, nós injetamos o _rev atual dele no documento novo para permitir a atualização
        doc._rev = docExistente._rev;
        console.log(
          `Documento ${doc._id} encontrado. Atualizando para a próxima revisão...`
        );
      } catch (err) {
        // Se der erro 404 significa que o documento não existe ainda, então tudo bem, criamos do zero
        if (err.statusCode !== 404) throw err;
        console.log(`Documento ${doc._id} é novo. Criando do zero...`);
      }

      // 3. Insere ou atualiza o documento com segurança
      await db.insert(doc);
      console.log(
        `Documento ${doc._id} gravado com sucesso no banco "${disciplina}"!`
      );
    }

    res.send("Sincronização realizada");
  } catch (err) {
    console.error("Erro detalhado no CouchDB:", err.message);
    res.status(500).send("Erro interno ao salvar no CouchDB");
  }
});

// Rota para a Secretaria/Instituição ver as frequências
app.get("/institucional/frequencia/:disciplina", async (req, res) => {
  const disciplina = req.params.disciplina;

  try {
    const db = nano.use(disciplina);

    // Busca todos os documentos dentro do banco daquela disciplina
    const listaDocs = await db.list({ include_docs: true });

    // Se você salvou usando o padrão 'chamada_atualizada' ou 'chamada_DATA'
    // Vamos filtrar apenas os documentos que contêm os dados dos alunos
    const chamadas = listaDocs.rows
      .map((row) => row.doc)
      .filter((doc) => doc._id.startsWith("chamada")); // filtra lixos de configuração se houver

    if (chamadas.length === 0) {
      return res
        .status(404)
        .json({ mensagem: "Nenhuma chamada registrada para esta disciplina." });
    }

    // Objeto para consolidar o relatório final dos alunos
    const relatorioFrequencia = {};

    // Processa cada chamada para somar as presenças
    chamadas.forEach((chamada) => {
      chamada.dados.forEach((alunoObj) => {
        const nome = alunoObj.aluno;

        if (!relatorioFrequencia[nome]) {
          relatorioFrequencia[nome] = {
            nome: nome,
            presencas: 0,
            faltas: 0,
            totalAulas: 0,
          };
        }

        // Verifica o status de cada aula dentro do array do aluno
        alunoObj.aulas.forEach((aula) => {
          relatorioFrequencia[nome].totalAulas++;
          if (aula.status === "presente") {
            relatorioFrequencia[nome].presencas++;
          } else {
            relatorioFrequencia[nome].faltas++;
          }
        });
      });
    });

    // Transforma o objeto em um array e calcula a porcentagem de frequência de cada um
    const resultadoFinal = Object.values(relatorioFrequencia).map((aluno) => {
      const porcentagem =
        aluno.totalAulas > 0
          ? ((aluno.presencas / aluno.totalAulas) * 100).toFixed(1)
          : 0;

      return {
        nome: aluno.nome,
        presencas: aluno.presencas,
        faltas: aluno.faltas,
        totalAulas: aluno.totalAulas,
        frequenciaPorcentagem: `${porcentagem}%`,
        situacao: porcentagem >= 75 ? "FI" : "RE", // FI = Frequência Insuficiente (Abaixo de 75% na UFSC reprova)
      };
    });

    res.json(resultadoFinal);
  } catch (err) {
    console.error("Erro ao gerar relatório institucional:", err);
    res.status(500).send("Erro interno ao buscar dados institucionais");
  }
});

app.listen(7000, () => {
  console.log("Servidor iniciado");
});
