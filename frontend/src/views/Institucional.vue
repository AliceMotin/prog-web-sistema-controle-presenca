<template>
  <div class="admin-container">
    <header class="admin-topo">
      <button @click="fazerLogout">Ir para Login</button>
      <h2>Portal Administrativo UFSC - Controle de Frequência</h2>
    </header>

    <main class="admin-conteudo">
      <div class="busca-secao">
        <label for="id-busca">Código da Disciplina: </label>
        <input
          id="id-busca"
          v-model="disciplinaBusca"
          placeholder="Ex: dec0020"
          @keyup.enter="buscarRelatorio"
        />
        <button @click="buscarRelatorio">Gerar Relatório</button>
      </div>

      <div v-if="erro" class="mensagem-erro">{{ erro }}</div>

      <div v-if="alunosRelatorio.length > 0" class="tabela-secao">
        <h3>
          Relatório de Frequência Consolidado:
          {{ disciplinaBusca.toUpperCase() }}
        </h3>

        <table>
          <thead>
            <tr>
              <th>Estudante</th>
              <th>Total de Aulas</th>
              <th>Presenças</th>
              <th>Faltas</th>
              <th>% Frequência</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="aluno in alunosRelatorio" :key="aluno.nome">
              <td>{{ aluno.nome }}</td>
              <td>{{ aluno.totalAulas }}</td>
              <td class="text-verde">{{ aluno.presencas }}</td>
              <td class="text-vermelho">{{ aluno.faltas }}</td>
              <td>
                <strong>{{ aluno.frequenciaPorcentagem }}</strong>
              </td>
              <td>
                <span
                  :class="
                    aluno.situacao === 'RE'
                      ? 'badge-reprovado'
                      : 'badge-regular'
                  "
                >
                  {{ aluno.situacao === "RE" ? "Abaixo de 75% 🚨" : "Regular" }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  name: "Institucional",
  data() {
    return {
      disciplinaBusca: "",
      alunosRelatorio: [],
      erro: null,
    };
  },
  methods: {
    async buscarRelatorio() {
      if (!this.disciplinaBusca) return;
      this.erro = null;
      this.alunosRelatorio = [];

      try {
        // 1. Pega o token que foi guardado no momento do login
        const token = localStorage.getItem("token_ufsc");

        if (!token) {
          this.erro =
            "Você não está autenticado. Por favor, faça login novamente.";
          return;
        }

        // 2. Faz a requisição enviando o token no cabeçalho Authorization
        // Repare na rota: estamos passando a disciplina em letras minúsculas para bater com o CouchDB
        const resposta = await fetch(
          `http://localhost:7000/institucional/frequencia/${this.disciplinaBusca.toLowerCase()}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              // 🔴 O SEGREDO ESTÁ AQUI: O "Bearer " precisa do espaço e do token logo em seguida!
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // 3. Trata as respostas de erro do servidor
        if (!resposta.ok) {
          if (resposta.status === 401) {
            throw new Error(
              "Sessão expirada ou token inválido. Faça login novamente."
            );
          }
        }

        // 4. Se deu tudo certo, joga os dados na tabela
        this.alunosRelatorio = await resposta.json();
      } catch (err) {
        this.erro = err.message;
        console.error("Erro na busca institucional:", err);
      }
    },
    fazerLogout() {
      // Limpa o cofre e volta para o login
      localStorage.removeItem("token_ufsc");
      this.$router.push("/login");
    },
  },
};
</script>

<style scoped>
.admin-container {
  padding: 20px;
  font-family: sans-serif;
  max-width: 1000px;
  margin: 0 auto;
}
.admin-topo {
  border-bottom: 3px solid #005a9c;
  padding-bottom: 10px;
  margin-bottom: 20px;
}
.busca-secao {
  margin-bottom: 20px;
}
input {
  padding: 8px;
  margin-right: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button {
  padding: 8px 15px;
  background-color: #005a9c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}
th,
td {
  border: 1px solid #ddd;
  padding: 10px;
  text-align: left;
}
th {
  background-color: #f4f4f4;
}
.text-verde {
  color: green;
  font-weight: bold;
}
.text-vermelho {
  color: red;
  font-weight: bold;
}
.badge-regular {
  color: green;
  font-weight: bold;
}
.badge-reprovado {
  color: white;
  background: red;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 12px;
}
.mensagem-erro {
  color: red;
  font-weight: bold;
  margin-top: 10px;
}
</style>
