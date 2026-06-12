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
  { aluno: "cintia", aulas: [] },
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

  if (email === "admin@ufsc.br" && senha === "admin") {
    const token = jwt.sign({ id: "admin" }, SECRET);
    return res.json({ token });
  }

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

app.get("/init", async (req, res) => {
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

app.get("/disciplinas", autenticar, (req, res) => {
  res.send(retornaListaDisciplinas(req.usuario));
});

app.get("/disciplinas/:disciplina", autenticar, (req, res) => {
  const disciplina = req.params.disciplina;
  let x = dadosDiscplina(disciplina);
  res.send(x);
});

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
        const docExistente = await db.get(doc._id);
        doc._rev = docExistente._rev;
      } catch (err) {
        if (err.statusCode !== 404) throw err;
        console.log(`Documento ${doc._id} é novo. Criando do zero`);
      }

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

app.get(
  "/institucional/frequencia/:disciplina",
  autenticar,
  async (req, res) => {
    if (req.usuario !== "admin") {
      return res
        .status(403)
        .send("Acesso negado. Apenas a administração pode ver estes dados.");
    }

    const disciplina = req.params.disciplina;

    try {
      const db = nano.use(disciplina);

      const listaDocs = await db.list({ include_docs: true });
      const linhas = listaDocs.rows;

      const chamadas = [];
      for (let i = 0; i < linhas.length; i++) {
        let doc = linhas[i].doc;
        if (doc._id.indexOf("chamada") === 0) {
          chamadas.push(doc);
        }
      }

      if (chamadas.length === 0) {
        return res.status(404).json({
          mensagem: "Nenhuma chamada registrada para esta disciplina.",
        });
      }

      const relatorioFrequencia = {};
      for (let c = 0; c < chamadas.length; c++) {
        let listaAlunosChamada = chamadas[c].dados;

        for (let a = 0; a < listaAlunosChamada.length; a++) {
          let alunoObj = listaAlunosChamada[a];
          let nomeAluno = alunoObj.aluno;

          if (!relatorioFrequencia[nomeAluno]) {
            relatorioFrequencia[nomeAluno] = {
              nome: nomeAluno,
              presencas: 0,
              faltas: 0,
              totalAulas: 0,
            };
          }

          let listaAulas = alunoObj.aulas;
          for (let au = 0; au < listaAulas.length; au++) {
            relatorioFrequencia[nomeAluno].totalAulas++;

            if (listaAulas[au].status === "presente") {
              relatorioFrequencia[nomeAluno].presencas++;
            } else {
              relatorioFrequencia[nomeAluno].faltas++;
            }
          }
        }
      }

      const resultadoFinal = [];
      const nomesChaves = Object.keys(relatorioFrequencia);

      for (let k = 0; k < nomesChaves.length; k++) {
        let aluno = relatorioFrequencia[nomesChaves[k]];

        let porcentagem = 0;
        if (aluno.totalAulas > 0) {
          porcentagem = ((aluno.presencas / aluno.totalAulas) * 100).toFixed(1);
        }

        resultadoFinal.push({
          nome: aluno.nome,
          presencas: aluno.presencas,
          faltas: aluno.faltas,
          totalAulas: aluno.totalAulas,
          frequenciaPorcentagem: `${porcentagem}%`,
          situacao: porcentagem >= 75 ? "FI" : "RE",
        });
      }

      res.json(resultadoFinal);
    } catch (err) {
      console.error("Erro ao gerar relatório institucional:", err);
      res.status(500).send("Erro interno ao buscar dados institucionais");
    }
  }
);

app.get("/init-chamadas", async (req, res) => {
  try {
    const disciplinasParaPopular = ["dec0007", "dec0020"];

    const alunosBase = ["Ana maria", "pedro", "cintia"];

    for (let d = 0; d < disciplinasParaPopular.length; d++) {
      let nomeDisciplina = disciplinasParaPopular[d];
      let db = nano.use(nomeDisciplina);

      for (let i = 5; i >= 1; i--) {
        let dataPassada = new Date();
        dataPassada.setDate(dataPassada.getDate() - i);

        let dia = String(dataPassada.getDate()).padStart(2, "0");
        let mes = String(dataPassada.getMonth() + 1).padStart(2, "0");
        let ano = dataPassada.getFullYear();

        let idFormatado = `chamada_${dia}-${mes}-${ano}`;
        let dataLegivel = `${dia}/${mes}/${ano}`;

        let dadosAlunosSorteados = [];
        for (let a = 0; a < alunosBase.length; a++) {
          let statusSorteado = "presente";
          if (Math.random() > 0.75) {
            statusSorteado = "falta";
          }

          dadosAlunosSorteados.push({
            aluno: alunosBase[a],
            aulas: [{ data: dataLegivel, status: statusSorteado }],
          });
        }

        let docChamada = {
          _id: idFormatado,
          data: dataLegivel,
          dados: dadosAlunosSorteados,
        };

        try {
          let docExistente = await db.get(idFormatado);
          docChamada._rev = docExistente._rev;
        } catch (err) {
          if (err.statusCode !== 404) throw err;
        }

        await db.insert(docChamada);
        console.log(` -> Documento ${idFormatado} injetado com sucesso!`);
      }
    }

    res.send(
      "Carga de dados de chamadas históricas realizada com sucesso nas disciplinas!"
    );
  } catch (err) {
    console.error("Erro ao inicializar dados de teste:", err.message);
    res.status(500).send("Erro interno ao gerar histórico de testes.");
  }
});

app.listen(7000, () => {
  console.log("Servidor iniciado");
});
