import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('pages/WizardPage.vue')
      },
      {
        path: 'processing',
        name: 'processing',
        component: () => import('pages/ProcessingPage.vue')
      },
      {
        path: 'models',
        name: 'models',
        component: () => import('pages/ModelManagementPage.vue')
      }
    ]
  },

  // Always leave this as last one
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
];

export default routes;
