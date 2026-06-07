<script>
import PouchDB from 'pouchdb/dist/pouchdb.js'

export default {
  name: 'Chamada',

  data() {
    return {
      disciplinaId: '', // Vai guardar o código da matéria (ex: dec0007)
      alunos: [], // Lista de alunos com as suas respetivas aulas/presenças
      statusMensagem: 'A carregar lista de alunos...',
      localDB: null, // Instância do banco PouchDB desta disciplina
    }
  },

  async mounted() {
    // 1. Pega o nome da disciplina que veio pela URL do Vue Router
    this.disciplinaId = this.$route.params.id

    // 2. Conecta ao banco PouchDB específico desta disciplina
    this.localDB = new PouchDB(this.disciplinaId)

    // 3. Tenta carregar os dados
    await this.carregarDadosDisciplina()

    window.addEventListener('online', this.enviarDadosParaServidor)
  },
  // Importante: Limpa o vigia quando o componente for destruído (mudar de página)
  unmounted() {
    window.removeEventListener('online', this.enviarDadosParaServidor)
  },

  methods: {
    async enviarDadosParaServidor() {
      try {
        this.statusMensagem = 'A tentar sincronizar com o servidor central...'

        // 1. Pega os dados mais recentes do PouchDB local
        const docLocal = await this.localDB.get('lista_alunos')

        // 2. CORREÇÃO: Formata o documento exatamente como o server.js espera!
        // O CouchDB precisa de um _id único para o documento. Podemos usar a data de hoje ou o id 'lista_alunos'
        // Como o professor faz um loop "for (const doc of docs)", vamos enviar o nosso documento dentro de um array:
        const corpoRequisicao = {
          docs: [
            {
              _id: 'chamada_atualizada', // ID do documento que vai nascer no CouchDB
              dados: docLocal.dados, // A lista de alunos com as faltas/presenças
            },
          ],
        }

        const token = localStorage.getItem('token_ufsc')

        // 3. CORREÇÃO: Altera a URL para /sync/ e o método para POST
        const resposta = await fetch(`http://localhost:7000/sync/${this.disciplinaId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(corpoRequisicao), // Envia o formato com .docs
        })

        if (!resposta.ok) {
          if (resposta.status === 403) {
            throw new Error('Professor sem acesso a esta disciplina.')
          }
          throw new Error('O servidor recusou os dados.')
        }

        this.statusMensagem = 'Sincronizado! Chamada guardada no CouchDB com sucesso.'
        alert('Sucesso! A chamada foi enviada e registada no servidor central.')
      } catch (error) {
        this.statusMensagem = 'Não foi possível enviar. Dados mantidos em segurança no navegador.'
        alert(`Aviso: ${error.message}`)
        console.error('Erro na sincronização de envio:', error)
      }
    },

    async carregarDadosDisciplina() {
      try {
        const token = localStorage.getItem('token_ufsc')

        // Tenta buscar os dados mais frescos do servidor do professor
        const resposta = await fetch(`http://localhost:7000/disciplinas/${this.disciplinaId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!resposta.ok) throw new Error('Erro ao falar com o servidor')

        const dadosServidor = await resposta.json()

        // Se pegou do servidor, vamos guardar/atualizar no PouchDB local para garantir o offline
        await this.salvarAlunosNoPouchDB(dadosServidor)

        this.alunos = dadosServidor
        this.statusMensagem = 'Alunos sincronizados via servidor.'
      } catch (error) {
        // 🚨 O MILAGRE DO OFFLINE: Se o fetch falhar, busca do PouchDB!
        this.statusMensagem = 'Modo Offline: Carregando dados salvos localmente...'
        console.warn(error.message)

        await this.carregarDadosLocais()
      }
    },

    async salvarAlunosNoPouchDB(dadosAlunos) {
      try {
        // Tenta buscar se já existe um documento com a lista de alunos
        const docExistente = await this.localDB.get('lista_alunos')

        // Se existe, atualiza mantendo o _rev para evitar conflito
        await this.localDB.put({
          _id: 'lista_alunos',
          _rev: docExistente._rev,
          dados: dadosAlunos,
        })
      } catch (err) {
        if (err.status === 404) {
          // Se não existe (404), cria do zero
          await this.localDB.put({
            _id: 'lista_alunos',
            dados: dadosAlunos,
          })
        }
      }
    },

    async carregarDadosLocais() {
      try {
        const docLocal = await this.localDB.get('lista_alunos')
        this.alunos = docLocal.dados
        this.statusMensagem = 'Dados locais carregados com sucesso (Offline).'
      } catch (err) {
        this.statusMensagem = 'Erro: Sem dados locais e sem internet para esta disciplina.'
      }
    },

    alterarPresenca(index, status) {
      // Cria uma aula fake de teste (ex: aula do dia de hoje)
      const dataHoje = new Date().toLocaleDateString('pt-BR')

      // Procura se já existe um registo para o dia de hoje nas aulas do aluno
      const aulaHojeIndex = this.alunos[index].aulas.findIndex((a) => a.data === dataHoje)

      if (aulaHojeIndex !== -1) {
        // Se já existe, atualiza o status (Presença ou Falta)
        this.alunos[index].aulas[aulaHojeIndex].status = status
      } else {
        // Se não existe, adiciona uma nova aula à lista dele
        this.alunos[index].aulas.push({ data: dataHoje, status: status })
      }
    },

    // Retorna o status atual do aluno no dia de hoje para pintar os botões
    obterStatusHoje(aluno) {
      const dataHoje = new Date().toLocaleDateString('pt-BR')
      const aula = aluno.aulas.find((a) => a.data === dataHoje)
      return aula ? aula.status : 'pendente'
    },

    async salvarChamadaCompleta() {
      try {
        // 1. Salva localmente
        await this.salvarAlunosNoPouchDB(this.alunos)

        // 2. Dispara o envio para o servidor
        await this.enviarDadosParaServidor() // 👈 ESSA LINHA TEM DE ESTAR AQUI!

        alert('Chamada registrada com sucesso!')
      } catch (e) {
        alert('Erro ao salvar chamada.')
      }
    },
  },
}
</script>

<template>
  <div class="chamada-container">
    <header class="topo">
      <button @click="$router.push('/')">⬅ Voltar ao Painel</button>
      <h2>Chamada: {{ disciplinaId ? disciplinaId.toUpperCase() : '' }}</h2>
    </header>

    <div class="status-barra">
      <p>{{ statusMensagem }}</p>
    </div>

    <main class="lista-alunos">
      <div v-for="(item, index) in alunos" :key="item.aluno" class="linha-aluno">
        <span class="nome-aluno">{{ item.aluno }}</span>

        <div class="acoes">
          <button
            :class="['btn-presenca', { ativo: obterStatusHoje(item) === 'presente' }]"
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
