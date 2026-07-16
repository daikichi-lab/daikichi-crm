'use server';
import { revalidatePath } from 'next/cache';
import { updateNoteTodos } from '@/lib/data/dal';

export async function updateNoteTodosAction(id: string, todos: string[]): Promise<void> {
  await updateNoteTodos(id, todos);
  revalidatePath(`/notes/${id}`);
  revalidatePath('/notes');
}
