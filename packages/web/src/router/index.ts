import { createRouter, createWebHistory } from 'vue-router'
import AdminView from '@/views/AdminView.vue'
import OverlayView from '@/views/OverlayView.vue'
import PreviewView from '@/views/PreviewView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'admin',
      component: AdminView,
    },
    {
      path: '/overlay',
      name: 'overlay',
      component: OverlayView,
    },
    {
      path: '/preview',
      name: 'preview',
      component: PreviewView,
    },
  ],
})

export default router
