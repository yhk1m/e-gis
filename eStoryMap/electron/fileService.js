// © 2026 김용현
// eStoryMap/electron/fileService.js
// ~/Desktop/eStoryMap/ 폴더 관리 + .esm 프로젝트 파일 목록/읽기/쓰기.
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

export function baseDir() {
  return path.join(app.getPath('desktop'), 'eStoryMap');
}

export function ensureBaseDir() {
  const dir = baseDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sanitize(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || 'untitled';
}

export async function listProjects() {
  const dir = ensureBaseDir();
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.esm'))
    .map((e) => e.name.replace(/\.esm$/, ''));
}

export async function readProject(name) {
  const file = path.join(ensureBaseDir(), sanitize(name) + '.esm');
  return await fsp.readFile(file, 'utf-8');
}

export async function writeProject(name, json) {
  const file = path.join(ensureBaseDir(), sanitize(name) + '.esm');
  await fsp.writeFile(file, json, 'utf-8');
  return path.basename(file);
}
