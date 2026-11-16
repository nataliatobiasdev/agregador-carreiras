import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let app: ElectronApplication
let page: Page
let dataDir: string

test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'cam-e2e-'))
  app = await electron.launch({
    args: [
      join(__dirname, '../../out/main/index.js'),
      ...(process.platform === 'linux' ? ['--no-sandbox'] : [])
    ],
    env: { ...process.env, CAM_DATA_DIR: dataDir, NODE_ENV: 'production' }
  })
  page = await app.firstWindow()
  await page.waitForSelector('text=Candidaturas')
})

test.afterAll(async () => {
  await app?.close()
  rmSync(dataDir, { recursive: true, force: true })
})

test('registers an application with the 4 required fields using only the keyboard', async () => {
  await expect(page.getByText('Nenhuma candidatura registrada ainda')).toBeVisible()
  await page.keyboard.press('Control+n')
  const dialog = page.getByRole('dialog', { name: 'Nova candidatura' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Empresa *').fill('Nubank')
  await dialog.getByLabel('Cargo *').fill('Engenheira de Software Sênior')
  await dialog.getByLabel('Plataforma *').selectOption('linkedin')
  await dialog.getByLabel('Cargo *').press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('cell', { name: 'Nubank' })).toBeVisible()
  await expect(page.getByText('Candidatura registrada')).toBeVisible()
})

test('changes the stage and sees it in the timeline and header', async () => {
  await page.getByRole('cell', { name: 'Nubank' }).click()
  await expect(page.getByRole('heading', { name: 'Engenheira de Software Sênior' })).toBeVisible()
  await page.keyboard.press('e')
  const dialog = page.getByRole('dialog', { name: 'Mudar etapa' })
  await dialog.getByLabel('Nova etapa').selectOption({ label: 'Entrevista RH · Triagem' })
  await dialog.getByRole('button', { name: 'Registrar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Mudança de etapa')).toBeVisible()
  await expect(page.getByText('Primeira resposta em')).toBeVisible()
})

test('attaches a file and keeps one copy for duplicates', async () => {
  const file = join(dataDir, 'descricao-vaga.pdf')
  writeFileSync(file, '%PDF-1.4 teste e2e')
  await page.getByRole('tab', { name: /Arquivos/ }).click()
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByText('descricao-vaga.pdf')).toBeVisible()
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(page.getByText('descricao-vaga.pdf')).toHaveCount(2)
})

test('finds the application with Ctrl+K ignoring accents', async () => {
  await page.keyboard.press('Control+k')
  await page.getByPlaceholder(/Buscar candidaturas/).fill('senior nubank')
  await expect(page.getByRole('option', { name: /Engenheira de Software Sênior/ })).toBeVisible()
  await page.keyboard.press('Escape')
})

test('deletes to the trash and restores everything', async () => {
  await page.getByRole('main').getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(page.getByText('Candidatura movida para a Lixeira')).toBeVisible()
  await page.getByRole('link', { name: 'Lixeira' }).click()
  await expect(page.getByRole('main').getByText('Engenheira de Software Sênior')).toBeVisible()
  await page.getByRole('main').getByRole('button', { name: 'Restaurar' }).click()
  await expect(page.getByText('A Lixeira está vazia')).toBeVisible()
  await page.getByRole('link', { name: 'Candidaturas' }).click()
  await page.getByRole('cell', { name: 'Nubank' }).click()
  await page.getByRole('tab', { name: /Arquivos/ }).click()
  await expect(page.getByText('descricao-vaga.pdf')).toHaveCount(2)
})

test('creates and tests a backup from the settings page', async () => {
  await page.getByRole('link', { name: 'Configurações' }).click()
  await page.getByRole('button', { name: 'Fazer backup agora' }).click()
  await expect(page.getByText(/Backup criado/)).toBeVisible()
  await page.getByRole('button', { name: 'Testar', exact: true }).first().click()
  await expect(page.getByText('Backup íntegro: pode ser restaurado.')).toBeVisible()
})
