import {SupabaseClient} from "@supabase/supabase-js";
import {FileObject} from "@supabase/storage-js";
import {Database} from "@/lib/types";

/**
 * My Files bucket. Objects live at `{userId}/{sanitizedFileName}`.
 * Chat attachments use the separate `files` bucket (Phase 5).
 * Optional metadata can go in `user_files`; list/upload/delete talk to Storage.
 */
export const USER_FILES_BUCKET = 'user-files'

/** Folder markers and hidden objects created by handle_new_user / Storage. */
export function isListedUserFile(file: FileObject): boolean {
    if (!file.name || file.name.endsWith('/')) return false
    if (file.name.startsWith('.')) return false
    if (file.id === null) return false
    return true
}

/** `{userId}/{sanitizedOriginalName}` — must match storage RLS path prefix. */
export function userFileObjectPath(userId: string, originalName: string): string {
    const safeName = originalName.replace(/[^0-9a-zA-Z!\-_.*'()]/g, '_')
    return `${userId}/${safeName}`
}

/** Join a listed object name (already stored) with the owner prefix. */
export function userFileStoredPath(userId: string, storedName: string): string {
    return `${userId}/${storedName}`
}

export enum ClientType {
    SERVER = 'server',
    SPA = 'spa'

}

export class SassClient {
    private client: SupabaseClient<Database, "public", "public">;
    private clientType: ClientType;

    constructor(client: SupabaseClient<Database, "public", "public">, clientType: ClientType) {
        this.client = client;
        this.clientType = clientType;

    }

    async loginEmail(email: string, password: string) {
        return this.client.auth.signInWithPassword({
            email: email,
            password: password
        });
    }

    async registerEmail(email: string, password: string) {
        return this.client.auth.signUp({
            email: email,
            password: password
        });
    }

    async exchangeCodeForSession(code: string) {
        return this.client.auth.exchangeCodeForSession(code);
    }

    async resendVerificationEmail(email: string) {
        return this.client.auth.resend({
            email: email,
            type: 'signup'
        })
    }

    async logout() {
        const { error } = await this.client.auth.signOut({
            scope: 'local',
        });
        if (error) throw error;
        if(this.clientType === ClientType.SPA) {
            window.location.href = '/auth/login';
        }
    }

    async uploadFile(myId: string, filename: string, file: File) {
        return this.client.storage.from(USER_FILES_BUCKET).upload(
            userFileObjectPath(myId, filename),
            file
        );
    }

    async getFiles(myId: string) {
        const result = await this.client.storage.from(USER_FILES_BUCKET).list(myId)
        if (result.data) {
            result.data = result.data.filter(isListedUserFile)
        }
        return result
    }

    async deleteFile(myId: string, filename: string) {
        return this.client.storage.from(USER_FILES_BUCKET).remove([
            userFileStoredPath(myId, filename)
        ])
    }

    async shareFile(myId: string, filename: string, timeInSec: number, forDownload: boolean = false) {
        return this.client.storage.from(USER_FILES_BUCKET).createSignedUrl(
            userFileStoredPath(myId, filename),
            timeInSec,
            { download: forDownload }
        );
    }

    async getMyTodoList(page: number = 1, pageSize: number = 100, order: string = 'created_at', done: boolean | null = false) {
        let query = this.client.from('todo_list').select('*').range(page * pageSize - pageSize, page * pageSize - 1).order(order)
        if (done !== null) {
            query = query.eq('done', done)
        }
        return query
    }

    async createTask(row: Database["public"]["Tables"]["todo_list"]["Insert"]) {
        return this.client.from('todo_list').insert(row)
    }

    async removeTask (id: number) {
        return this.client.from('todo_list').delete().eq('id', id)
    }

    async updateAsDone (id: number) {
        return this.client.from('todo_list').update({done: true}).eq('id', id)
    }

    getSupabaseClient() {
        return this.client;
    }


}
