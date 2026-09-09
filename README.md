# Sistema de Controle de Presença (Offline-First)

Trabalho desenvolvido para a disciplina de **Programação Web** da Universidade Federal de Santa Catarina (UFSC) - Campus Araranguá.

## Sobre o Projeto

O sistema consiste em uma aplicação web desenvolvida para o registro de presença e ausência de estudantes em sala de aula. O projeto foi idealizado para solucionar problemas de instabilidade de conexão na instituição, substituindo o uso de listas de papel ou dependência estrita de internet.

A aplicação utiliza o conceito de **Offline-First**, empregando o **PouchDB** para armazenamento local no dispositivo do professor. Assim, as chamadas podem ser feitas sem conexão com a internet e, quando o acesso é restabelecido, os dados são sincronizados automaticamente com o servidor remoto.

---

## Funcionalidades

* **Registro Offline:** Lançamento de presenças e ausências diretamente no dispositivo local utilizando PouchDB.
* **Sincronização Automática:** Envio e atualização dos dados para o servidor remoto assim que a conexão com a internet é detectada.
* **Interface Administrativa:** Painel web dedicado para a instituição acompanhar e visualizar o histórico de frequências dos estudantes.

---

## Tecnologias Utilizadas

* **Front-end:** Vue.js.
* **Armazenamento Local:** PouchDB.
* **Servidor / Sincronização:** Node.js / CouchDB.

---

## Como Executar o Projeto

### Pré-requisitos
* Node.js instalado na máquina.

### 1. Clonar o repositório
```bash
git clone [https://github.com/AliceMotin/prog-web-sistema-controle-presenca.git](https://github.com/AliceMotin/prog-web-sistema-controle-presenca.git)
cd prog-web-sistema-controle-presenca
```
### 2. Instalar as dependências
```bash
npm install
```
### 3. Executar o Servidor / Aplicação
```bash
npm start
```

## 👩‍💻 **Desenvolvido por:**  
| [<img loading="lazy" src="https://avatars.githubusercontent.com/u/112569754?v=4" width=115><br><sub>Alice Motin</sub>](https://github.com/AliceMotin) | 
| :---: |
