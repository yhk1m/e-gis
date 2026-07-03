// © 2026 김용현
// eStoryMap/electron/fileService.js
// ~/Desktop/e-GIStory/ 폴더 관리 + .esm 프로젝트 파일 목록/읽기/쓰기.
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

export function baseDir() {
  return path.join(app.getPath('desktop'), 'e-GIStory');
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

/**
 * 문서를 열기 전 세션 스냅샷: {name}.esm → .backups/{name}-{timestamp}.esm 복사.
 * 파일이 없으면(새 문서) null. 디바운스 자동저장마다가 아니라 "열기 시 1회"만
 * 호출된다(저장마다 백업하면 세션당 수백 개 — 상위 스펙 §3b의 목적만 유지).
 */
export async function backupProject(name) {
  const dir = ensureBaseDir();
  const file = path.join(dir, sanitize(name) + '.esm');
  if (!fs.existsSync(file)) return null;
  const backupDir = path.join(dir, '.backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `${sanitize(name)}-${stamp}.esm`);
  await fsp.copyFile(file, dest);
  return path.basename(dest);
}
