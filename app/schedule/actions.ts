'use server';
import { revalidatePath } from 'next/cache';
import { createTask, updateScheduleItem, completeScheduleItem, deleteTask, addTaskComment, taskFormLookup } from '@/lib/data/dal';
import { stripDangerousHtml } from '@/lib/richtext';

export type TaskPayload = {
  title?: string; company_id?: string; parent_id?: string; scope?: 'client' | 'internal';
  kind?: string; description?: string; start_date?: string; due_date?: string;
  assignee?: string; status?: string; progress?: number; extra?: Record<string, unknown>;
};

function revalidate(id?: string) {
  revalidatePath('/schedule');
  if (id) revalidatePath(`/schedule/${id}`);
}

// 説明（リッチテキストHTML）はサーバ側でも危険な構造を除去（多層防御）。最終防御は描画時の DOMPurify。
function sanitizePayload(p: TaskPayload): TaskPayload {
  return p.description == null ? p : { ...p, description: stripDangerousHtml(p.description) };
}

export async function createTaskAction(p: TaskPayload) {
  const r = await createTask(sanitizePayload(p));
  revalidate(p.parent_id);
  return r;
}

export async function completeScheduleItemAction(id: string) {
  const r = await completeScheduleItem(id);
  revalidate(id);
  return r;
}

export async function updateScheduleItemAction(id: string, p: TaskPayload) {
  const r = await updateScheduleItem(id, sanitizePayload(p));
  revalidate(id);
  return r;
}

export async function deleteTaskAction(id: string) {
  const r = await deleteTask(id);
  revalidate(id);
  return r;
}

export async function addTaskCommentAction(id: string, body: string) {
  const r = await addTaskComment(id, body);
  revalidate(id);
  return r;
}

/** 課題フォーム用: 選択した企業/スコープの親課題・議事録・資料（read-only） */
export async function taskFormLookupAction(company: string | undefined, scope: 'client' | 'internal') {
  return taskFormLookup(company, scope);
}
