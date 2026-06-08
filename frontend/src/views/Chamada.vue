<script>
import PouchDB from "pouchdb/dist/pouchdb.js";

export default {
  name: "Chamada",

  data() {
    return {
      disciplinaId: "", // Vai guardar o código da matéria (ex: dec0007)
      alunos: [], // Lista de alunos com as suas respetivas aulas/presenças
      statusMensagem: "A carregar lista de alunos...",
      localDB: null, // Instância do banco PouchDB desta disciplina
    };
  },

  async mounted() {
    // 1. Pega o nome da disciplina que veio pela URL do Vue Router
    this.disciplinaId = this.$route.params.id;

    // 2. Conecta ao banco PouchDB específico desta disciplina
    this.localDB = new PouchDB(this.disciplinaId);

    // 3. Tenta carregar os dados
    await this.carregarDadosDisciplina();

    window.addEventListener("online", this.enviarDadosParaServidor);
  },
  // Importante: Limpa o vigia quando o componente for destruído (mudar de página)
  unmounted() {
    window.removeEventListener("online", this.enviarDadosParaServidor);
  },

  methods: {
    async enviarDadosParaServidor() {
      try {
        this.statusMensagem = "A tentar sincronizar com o servidor central...";

        const docLocal = await this.localDB.get("lista_alunos");

        // 🔴 1. CAPTURA E FORMATA A DATA DE HOJE (Ex: "07-06-2026")
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, "0");
        const mes = String(hoje.getMonth() + 1).padStart(2, "0"); // Janeiro é 0
        const ano = hoje.getFullYear();
        const dataFormatada = `${dia}-${mes}-${ano}`;

        // 🔴 2. MONTA O CORPO COM O ID ÚNICO POR DIA
        const corpoRequisicao = {
          docs: [
            {
              _id: `chamada_${dataFormatada}`, // 👈 Ex: chamada_07-06-2026
              data: `${dia}/${mes}/${ano}`, // Guarda a data legível também
              dados: docLocal.dados, // O array de alunos com suas presenças
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

        // Tenta buscar os dados mais frescos do servidor do professor
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

        // Se pegou do servidor, vamos guardar/atualizar no PouchDB local para garantir o offline
        await this.salvarAlunosNoPouchDB(dadosServidor);

        this.alunos = dadosServidor;
        this.statusMensagem = "Alunos sincronizados via servidor.";
      } catch (error) {
        // 🚨 O MILAGRE DO OFFLINE: Se o fetch falhar, busca do PouchDB!
        this.statusMensagem =
          "Modo Offline: Carregando dados salvos localmente...";
        console.warn(error.message);

        await this.carregarDadosLocais();
      }
    },

    async salvarAlunosNoPouchDB(dadosAlunos) {
      try {
        // Tenta buscar se já existe um documento com a lista de alunos
        const docExistente = await this.localDB.get("lista_alunos");

        // Se existe, atualiza mantendo o _rev para evitar conflito
        await this.localDB.put({
          _id: "lista_alunos",
          _rev: docExistente._rev,
          dados: dadosAlunos,
        });
      } catch (err) {
        if (err.status === 404) {
          // Se não existe (404), cria do zero
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
      // Cria uma aula fake de teste (ex: aula do dia de hoje)
      const dataHoje = new Date().toLocaleDateString("pt-BR");

      // Procura se já existe um registo para o dia de hoje nas aulas do aluno
      const aulaHojeIndex = this.alunos[index].aulas.findIndex(
        (a) => a.data === dataHoje
      );

      if (aulaHojeIndex !== -1) {
        // Se já existe, atualiza o status (Presença ou Falta)
        this.alunos[index].aulas[aulaHojeIndex].status = status;
      } else {
        // Se não existe, adiciona uma nova aula à lista dele
        this.alunos[index].aulas.push({ data: dataHoje, status: status });
      }
    },

    // Retorna o status atual do aluno no dia de hoje para pintar os botões
    obterStatusHoje(aluno) {
      const dataHoje = new Date().toLocaleDateString("pt-BR");
      const aula = aluno.aulas.find((a) => a.data === dataHoje);
      return aula ? aula.status : "pendente";
    },

    async gerarMuitasChamadasDeTeste() {
      this.carregando = true;
      this.statusMensagem = "Injetando carga de dados de teste...";

      // Vamos usar a disciplina dec0020 como alvo dos testes (ou mude para a que preferir)
      const disciplinaAlvo = "dec0020";
      const token = localStorage.getItem("token_ufsc");

      // 1. Lista base de alunos para simular as chamadas
      const alunosBase = ["Ana maria", "pedro", "cintia"];
      const pacotesDeChamadas = [];

      // 2. Loop para gerar 5 dias diferentes de aulas no passado
      for (let i = 5; i >= 1; i--) {
        const dataPassada = new Date();
        dataPassada.setDate(dataPassada.getDate() - i); // Subtrai i dias da data de hoje

        const dia = String(dataPassada.getDate()).padStart(2, "0");
        const mes = String(dataPassada.getMonth() + 1).padStart(2, "0");
        const ano = dataPassada.getFullYear();

        const idFormatado = `chamada_${dia}-${mes}-${ano}`;
        const dataLegivel = `${dia}/${mes}/${ano}`;

        // Monta a lista de alunos com presenças/faltas aleatórias para dar realismo ao gráfico/tabela
        const dadosAlunosSorteados = alunosBase.map((nome) => {
          // Sorteia "presente" ou "falta" (75% de chance de presente para a maioria passar)
          const statusSorteado = Math.random() > 0.25 ? "presente" : "falta";
          return {
            aluno: nome,
            aulas: [{ data: dataLegivel, status: statusSorteado }],
          };
        });

        // Coloca o documento no pacote
        pacotesDeChamadas.push({
          _id: idFormatado,
          data: dataLegivel,
          dados: dadosAlunosSorteados,
        });
      }

      try {
        // 3. Dispara o pacote completo com os 5 dias de uma vez para a rota de sincronização
        const resposta = await fetch(
          `http://localhost:7000/sync/${disciplinaAlvo}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ docs: pacotesDeChamadas }), // O server.js faz o loop por cada um deles!
          }
        );

        if (!resposta.ok)
          throw new Error("O servidor rejeitou a carga de testes.");

        alert(
          `Sucesso! 5 chamadas históricas foram injetadas no banco "${disciplinaAlvo}".`
        );
        this.statusMensagem = "Dados de teste injetados com sucesso!";
      } catch (error) {
        console.error("Erro ao injetar chamadas:", error);
        alert("Falha ao injetar dados de teste no CouchDB.");
      } finally {
        this.carregando = false;
      }
    },

    async salvarChamadaCompleta() {
      try {
        // 1. Salva localmente
        await this.salvarAlunosNoPouchDB(this.alunos);

        // 2. Dispara o envio para o servidor
        await this.enviarDadosParaServidor(); // 👈 ESSA LINHA TEM DE ESTAR AQUI!

        alert("Chamada registrada com sucesso!");
      } catch (e) {
        alert("Erro ao salvar chamada.");
      }
    },
  },
};
</script>

<template>
  <div
    class="testes-secao"
    style="
      margin-top: 20px;
      padding: 15px;
      background: #fff3cd;
      border: 1px solid #ffeba2;
      border-radius: 8px;
    "
  >
    <h4>🧪 Zona de Testes Acadêmicos</h4>
    <p>
      Clique no botão abaixo para gerar instantaneamente 5 dias de chamadas
      retroativas no CouchDB para testes.
    </p>
    <button
      class="btn-seed"
      @click="gerarMuitasChamadasDeTeste"
      :disabled="carregando"
    >
      ⚡ Injetar 5 Chamadas de Histórico
    </button>
  </div>

  <div class="chamada-container">
    <header class="topo">
      <button @click="$router.push('/')">⬅ Voltar ao Painel</button>
      <h2>Chamada: {{ disciplinaId ? disciplinaId.toUpperCase() : "" }}</h2>
    </header>

    <div class="status-barra">
      <p>{{ statusMensagem }}</p>
    </div>

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
        💾 Salvar Chamada no Navegador
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
