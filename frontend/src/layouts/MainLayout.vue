<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title>
          <q-icon name="description" class="q-mr-sm" />
          AI Document Processing Wizard
        </q-toolbar-title>

        <q-btn
          flat
          icon="home"
          label="Wizard"
          to="/"
          class="q-mr-sm"
        />
        <q-btn
          flat
          icon="cloud_download"
          label="Models"
          to="/models"
        />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
// Main layout component
</script>
