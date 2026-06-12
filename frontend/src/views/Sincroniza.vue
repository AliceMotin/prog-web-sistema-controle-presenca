<script>
// Importamos o PouchDB para gerenciar o banco de dados no navegador
//import PouchDB from 'pouchdb'

import PouchDB from "pouchdb/dist/pouchdb.js";

export default {
  name: "Sincroniza",

  data() {
    return {
      professorId: "",
      disciplinas: [],
      carregando: true,
    };
  },

  async mounted() {
    await this.carregarDisciplinasDoServidor();
  },

  methods: {
    async carregarDisciplinasDoServidor() {
      try {
        const token = localStorage.getItem("token_ufsc");

        if (!token) {
          this.statusMensagem = "Usuário não autenticado. Redirecionando...";
          setTimeout(() => this.$router.push("/login"), 2000);
          return;
        }

        const resposta = await fetch("http://localhost:7000/disciplinas", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!resposta.ok) {
          if (resposta.status === 401) {
            this.statusMensagem = "Sessão expirada. Faça login novamente.";
            this.$router.push("/login");
          } else {
            this.statusMensagem = "Erro ao buscar disciplinas no servidor.";
          }
          return;
        }

        this.disciplinas = await resposta.json();
        await this.inicializarBancosLocais();

        this.carregando = false;
      } catch (error) {
        this.statusMensagem =
          "Você está offline ou o servidor está desligado. Usando dados locais.";
        console.error(error);
        this.carregando = false;
      }
    },

    async inicializarBancosLocais() {
      const dbListaControle = new PouchDB("lista_disciplinas_local");

      await dbListaControle
        .put({
          _id: "config_disciplinas",
          lista: this.disciplinas,
        })
        .catch((err) => {
          if (err.status !== 409) console.error(err);
        });

      for (const disc of this.disciplinas) {
        const localDB = new PouchDB(disc);
        console.log(`Banco local PouchDB pronto para a disciplina: ${disc}`);
      }
    },

    fazerLogout() {
      localStorage.removeItem("token_ufsc");
      this.$router.push("/login");
    },
  },
};
</script>

<template>
  <div class="dashboard-container">
    <header class="topo">
      <h2>Painel do Professor</h2>
      <button class="btn-sair" @click="fazerLogout">Sair do Sistema</button>
    </header>

    <main class="conteudo">
      <div v-if="!carregando" class="disciplinas-secao">
        <h3>Suas Disciplinas Ativas</h3>

        <div class="lista-grid">
          <div v-for="disc in disciplinas" :key="disc" class="card-disciplina">
            <h4>{{ disc.toUpperCase() }}</h4>
            <p>Banco de dados local sincronizado.</p>
            <button
              class="btn-entrar"
              @click="$router.push(`/chamada/${disc}`)"
            >
              Fazer Chamada
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding: 20px;
  font-family: sans-serif;
  max-width: 900px;
  margin: 0 auto;
}
.topo {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #ccc;
  padding-bottom: 10px;
}
.status-card {
  background: #f0f4f8;
  padding: 15px;
  border-radius: 8px;
  margin: 20px 0;
  border-left: 5px solid blue;
}
.lista-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 15px;
}
.card-disciplina {
  background: white;
  border: 1px solid #ddd;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  text-align: center;
}
.btn-sair {
  background: #ff3333;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 5px;
  cursor: pointer;
}
.btn-entrar {
  background: blue;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 10px;
}
.btn-entrar:hover {
  background: darkblue;
}
.btn-sair:hover {
  background: darkred;
}
</style>
