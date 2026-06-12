<script>
import PouchDB from "pouchdb/dist/pouchdb.js";

export default {
  name: "Chamada",

  data() {
    return {
      disciplinaId: "",
      alunos: [],
      localDB: null,
    };
  },

  async mounted() {
    this.disciplinaId = this.$route.params.id;

    this.localDB = new PouchDB(this.disciplinaId);

    await this.carregarDadosDisciplina();

    window.addEventListener("online", this.enviarDadosParaServidor);
  },
  unmounted() {
    window.removeEventListener("online", this.enviarDadosParaServidor);
  },

  methods: {
    async enviarDadosParaServidor() {
      try {
        const docLocal = await this.localDB.get("lista_alunos");

        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, "0");
        const mes = String(hoje.getMonth() + 1).padStart(2, "0"); // Janeiro é 0
        const ano = hoje.getFullYear();
        const dataFormatada = `${dia}-${mes}-${ano}`;

        const corpoRequisicao = {
          docs: [
            {
              _id: `chamada_${dataFormatada}`,
              data: `${dia}/${mes}/${ano}`,
              dados: docLocal.dados,
            },
          ],
        };

        const token = localStorage.getItem("token_ufsc");

        const resposta = await fetch(
          `http://localhost:7000/sync/${this.disciplinaId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(corpoRequisicao),
          }
        );

        if (!resposta.ok) {
          throw new Error("O servidor recusou os dados.");
        }

        this.statusMensagem =
          "Sincronizado! Chamada guardada no CouchDB com sucesso.";
      } catch (error) {
        this.statusMensagem = "Não foi possível enviar para o servidor.";
        console.error("Erro na sincronização de envio:", error);
      }
    },

    async carregarDadosDisciplina() {
      try {
        const token = localStorage.getItem("token_ufsc");

        const resposta = await fetch(
          `http://localhost:7000/disciplinas/${this.disciplinaId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!resposta.ok) throw new Error("Erro ao falar com o servidor");

        const dadosServidor = await resposta.json();

        await this.salvarAlunosNoPouchDB(dadosServidor);

        this.alunos = dadosServidor;
      } catch (error) {
        this.statusMensagem =
          "Modo Offline: Carregando dados salvos localmente...";
        console.warn(error.message);

        await this.carregarDadosLocais();
      }
    },

    async salvarAlunosNoPouchDB(dadosAlunos) {
      try {
        const docExistente = await this.localDB.get("lista_alunos");

        await this.localDB.put({
          _id: "lista_alunos",
          _rev: docExistente._rev,
          dados: dadosAlunos,
        });
      } catch (err) {
        if (err.status === 404) {
          await this.localDB.put({
            _id: "lista_alunos",
            dados: dadosAlunos,
          });
        }
      }
    },

    async carregarDadosLocais() {
      try {
        const docLocal = await this.localDB.get("lista_alunos");
        this.alunos = docLocal.dados;
        this.statusMensagem = "Dados locais carregados com sucesso (Offline).";
      } catch (err) {
        this.statusMensagem =
          "Erro: Sem dados locais e sem internet para esta disciplina.";
      }
    },

    alterarPresenca(index, status) {
      const dataHoje = new Date().toLocaleDateString("pt-BR");

      const aulaHojeIndex = this.alunos[index].aulas.findIndex(
        (a) => a.data === dataHoje
      );

      if (aulaHojeIndex !== -1) {
        this.alunos[index].aulas[aulaHojeIndex].status = status;
      } else {
        this.alunos[index].aulas.push({ data: dataHoje, status: status });
      }
    },

    obterStatusHoje(aluno) {
      const dataHoje = new Date().toLocaleDateString("pt-BR");
      const aula = aluno.aulas.find((a) => a.data === dataHoje);
      return aula ? aula.status : "pendente";
    },

    async salvarChamadaCompleta() {
      try {
        await this.salvarAlunosNoPouchDB(this.alunos);

        await this.enviarDadosParaServidor();

        alert("Chamada registrada com sucesso!");
      } catch (e) {
        alert("Erro ao salvar chamada.");
      }
    },
  },
};
</script>

<template>
  <div class="chamada-container">
    <header class="topo">
      <button @click="$router.push('/')">Voltar ao Painel</button>
      <h2>Chamada: {{ disciplinaId ? disciplinaId.toUpperCase() : "" }}</h2>
    </header>

    <main class="lista-alunos">
      <div
        v-for="(item, index) in alunos"
        :key="item.aluno"
        class="linha-aluno"
      >
        <span class="nome-aluno">{{ item.aluno }}</span>

        <div class="acoes">
          <button
            :class="[
              'btn-presenca',
              { ativo: obterStatusHoje(item) === 'presente' },
            ]"
            @click="alterarPresenca(index, 'presente')"
          >
            Presença
          </button>

          <button
            :class="['btn-falta', { ativo: obterStatusHoje(item) === 'falta' }]"
            @click="alterarPresenca(index, 'falta')"
          >
            Falta
          </button>
        </div>
      </div>

      <button class="btn-salvar" @click="salvarChamadaCompleta">
        Salvar Chamada
      </button>
    </main>
  </div>
</template>

<style scoped>
.chamada-container {
  padding: 20px;
  font-family: sans-serif;
  max-width: 600px;
  margin: 0 auto;
}
.topo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #eee;
}
.status-barra {
  background: #fff8e1;
  padding: 10px;
  margin: 15px 0;
  border-radius: 5px;
  text-align: center;
  font-size: 14px;
}
.linha-aluno {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #ddd;
}
.nome-aluno {
  font-size: 18px;
  text-transform: capitalize;
}
.acoes button {
  padding: 6px 12px;
  margin-left: 5px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: white;
}

/* Cores dinâmicas dos botões */
.btn-presenca.ativo {
  background-color: #4caf50;
  color: white;
  border-color: #4caf50;
}
.btn-falta.ativo {
  background-color: #f44336;
  color: white;
  border-color: #f44336;
}

.btn-salvar {
  display: block;
  width: 100%;
  margin-top: 25px;
  padding: 12px;
  background: blue;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
}
.btn-salvar:hover {
  background: darkblue;
}
</style>
