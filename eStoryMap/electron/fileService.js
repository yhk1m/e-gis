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

function projectFile(name) {
  return path.join(ensureBaseDir(), sanitize(name) + '.esm');
}

/** 같은 이름 파일이 있는지(대소문자 무시: Windows 파일 시스템 기준). */
async function exists(name) {
  const target = (sanitize(name) + '.esm').toLowerCase();
  const entries = await fsp.readdir(ensureBaseDir());
  return entries.some((n) => n.toLowerCase() === target);
}

/** 파일 내용의 제목(meta.title)을 바꾼 JSON. 읽지 못하는 파일이면 원문 그대로. */
function retitle(json, title) {
  try {
    const obj = JSON.parse(json);
    if (obj && obj.meta) obj.meta.title = title;
    return JSON.stringify(obj);
  } catch {
    return json;
  }
}

/**
 * 이름 바꾸기: 새 이름 파일을 쓰고 옛 파일을 지운다. 안의 제목(meta.title)도 같이 바꾼다.
 * 대소문자만 바뀌는 경우(Busan → busan)는 같은 파일이므로 덮어쓰기 검사에서 뺀다.
 */
export async function renameProject(from, to) {
  const src = projectFile(from);
  const dest = projectFile(to);
  const sameFile = src.toLowerCase() === dest.toLowerCase();
  if (!sameFile && (await exists(to))) throw new Error('같은 이름의 스토리맵이 이미 있어요.');
  const json = await fsp.readFile(src, 'utf-8');
  if (sameFile) await fsp.rm(src);
  await fsp.writeFile(dest, retitle(json, to), 'utf-8');
  if (!sameFile) await fsp.rm(src);
  return sanitize(to);
}

/** 사본 만들기: "{이름} 사본", 겹치면 "{이름} 사본 2", 3 ... */
export async function duplicateProject(name) {
  const json = await fsp.readFile(projectFile(name), 'utf-8');
  let copy = `${name} 사본`;
  for (let i = 2; await exists(copy); i += 1) copy = `${name} 사본 ${i}`;
  const obj = retitle(json, copy);
  // 사본은 클라우드 동기화를 끈 채로 시작(원본과 같은 클라우드 행을 덮어쓰지 않게)
  let out = obj;
  try {
    const o = JSON.parse(obj);
    if (o && o.meta) delete o.meta.cloudSync;
    if (o && o.meta) delete o.meta.publish;
    out = JSON.stringify(o);
  } catch { /* 원문 유지 */ }
  await fsp.writeFile(projectFile(copy), out, 'utf-8');
  return sanitize(copy);
}

/** 지우기: 바로 없애지 않고 .backups 폴더로 옮긴다(실수로 지워도 되찾을 수 있게). */
export async function deleteProject(name) {
  const dir = ensureBaseDir();
  const src = projectFile(name);
  const backupDir = path.join(dir, '.backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `${sanitize(name)}-지움-${stamp}.esm`);
  await fsp.rename(src, dest);
  return path.basename(dest);
}
