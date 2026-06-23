'use server';
import { revalidatePath } from 'next/cache';
import { createTask, updateScheduleItem, completeScheduleItem } from '@/lib/data/dal';

export async function createTaskAction(p: { company?: string; title: string; due_date?: string; assignee?: string; kind?: string }) {
  const r = await createTask(p);
  revalidatePath('/schedule');
  return r;
}

export async function completeScheduleItemAction(id: string) {
  const r = await completeScheduleItem(id);
  revalidatePath('/schedule');
  return r;
}

export async function updateScheduleItemAction(id: string, p: { status?: string; title?: string; due_date?: string; assignee?: string }) {
  const r = await updateScheduleItem(id, p);
  revalidatePath('/schedule');
  return r;
}
