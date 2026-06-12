<script>
export default {
  name: "Login",

  data() {
    return {
      email: "",
      senha: "",
      mensagemErro: "",
    };
  },

  methods: {
    async efetuarLogin() {
      try {
        this.mensagemErro = "";

        const resposta = await fetch("http://localhost:7000/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: this.email,
            senha: this.senha,
          }),
        });

        console.log("O servidor respondeu! O status HTTP é:", resposta.status);

        if (!resposta.ok) {
          if (resposta.status === 401) {
            this.mensagemErro = "E-mail ou senha incorretos!";
          } else {
            this.mensagemErro = "Erro no servidor ao tentar fazer login.";
          }
          return;
        }

        const dados = await resposta.json();
        localStorage.setItem("token_ufsc", dados.token);

        console.log(dados.token);

        const base64Url = dados.token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const dadosDecodificados = JSON.parse(window.atob(base64));

        console.log("Usuário logado:", dadosDecodificados.id);

        if (dadosDecodificados.id === "admin") {
          this.$router.push("/institucional");
        } else {
          this.$router.push("/");
        }
      } catch (error) {
        this.mensagemErro = "Não foi possível conectar ao servidor backend.";
        console.error(error);
      }
    },
  },
};
</script>

<template>
  <div class="primeira">
    <form class="form" @submit.prevent>
      <h1>Logar</h1>

      <label>
        <span> Seu Email</span>
        <input v-model="email" type="email" name="email" />
      </label>

      <label>
        <span> Senha</span>
        <input v-model="senha" type="password" name="senha" />
      </label>

      <p v-if="mensagemErro" class="erro">{{ mensagemErro }}</p>

      <button class="submit" type="button" @click="efetuarLogin">
        Logar - Clique Aqui
      </button>
    </form>
  </div>
</template>

<style scoped>
.primeira {
  display: inline-block;
  background: #fff;
  box-shadow:
    0 19px 38px black,
    0 15px 12px rgba(0, 0, 0, 0.22);
  border-radius: 25px;
  width: 100%;
  margin-left: 30px;
}

input,
button {
  border: none;
  outline: none;
  background: none;
}

h1 {
  color: black;
  padding-top: 10px;
  font-size: 30px;
}

.form {
  padding: 50px 30px;
  -webkit-transition: -webkit-transform 1.2s ease-in-out;
  transition: -webkit-transform 1.2s ease-in-out;
  transition: transform 1.2s ease-in-out;
  transition:
    transform 1.2s ease-in-out,
    -webkit-transform 1.2s ease-in-out;
}

label {
  display: block;
  width: 260px;
  margin: 25px auto 0;
  text-align: center;
}

label span {
  font-size: 14px;
  font-weight: 600;
  color: #505f75;
  text-transform: uppercase;
}

input {
  display: block;
  width: 100%;
  margin-top: 5px;
  font-size: 16px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(109, 93, 93, 0.4);
  text-align: center;
  font-family: "Nunito", sans-serif;
}

button {
  display: block;
  margin: 20px auto;

  width: 260px;
  height: 36px;
  border-radius: 30px;
  background-color: blue;
  color: white;
  font-size: 15px;
  cursor: pointer;
}

button:hover {
  background-color: red;
}
</style>
