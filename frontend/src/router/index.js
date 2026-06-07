import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Sincroniza from '../views/Sincroniza.vue'
import Chamada from '../views/Chamada.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: Login,
    },
    {
      path: '/',
      name: 'Sincroniza',
      component: Sincroniza,
    },
    {
      path: '/chamada/:id',
      name: 'Chamada',
      component: Chamada,
      meta: { requerAutenticacao: true },
    },
  ],
})

export default router
