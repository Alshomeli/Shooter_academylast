import { supabase } from './supabase';

export type ContentKind = 'news' | 'gallery' | 'video' | 'coach' | 'contact';
export type ContentPayload = Record<string, string>;
export interface ContentItem { id: string; kind: ContentKind; payload: ContentPayload; sort_order: number; version: number; updated_at?: string; published_at?: string; }
export interface ContentRevision { id: number; version: number; payload: ContentPayload; sort_order: number; action: string; changed_at: string; changed_by: string | null; }
const bucket = 'academy-content';

export function safeMediaUrl(value: string | undefined): string {
  if (!value) return '';
  if (value.startsWith('/home/') && !value.includes('..')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' ? value : ''; } catch { return ''; }
}

export async function resolveContentMedia(items: ContentItem[]): Promise<ContentItem[]> {
  return Promise.all(items.map(async item => {
    const payload = { ...item.payload };
    for (const field of ['image','video','poster','featured_image']) {
      const path = payload[`${field}_path`];
      if (path) {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        payload[field] = error ? '' : data.signedUrl;
      } else payload[field] = safeMediaUrl(payload[field]);
    }
    // Resolve uploaded images for editable training program cards (section 02).
    if (item.kind === 'contact' && payload.programs_v1) {
      try {
        const programs = JSON.parse(payload.programs_v1) as Array<Record<string, string>>;
        if (Array.isArray(programs)) {
          const resolved = await Promise.all(programs.slice(0, 20).map(async program => {
            if (!program.image_path) return { ...program, image: safeMediaUrl(program.image) };
            const { data, error } = await supabase.storage.from(bucket).createSignedUrl(program.image_path, 3600);
            return { ...program, image: error ? '' : data.signedUrl };
          }));
          payload.programs_v1 = JSON.stringify(resolved);
        }
      } catch { payload.programs_v1 = '[]'; }
    }
    return { ...item, payload };
  }));
}

export async function readPublicContent(): Promise<ContentItem[]> {
  const { data, error } = await supabase.from('academy_content_public').select('id,kind,payload,sort_order,published_at').order('sort_order').order('id');
  if (error) throw error;
  return resolveContentMedia(data as ContentItem[]);
}
export async function readManagerContent() {
  const { data, error } = await supabase.from('academy_content_drafts').select('*').order('sort_order').order('id');
  if (error) throw error;
  const { data: published, error: publicError } = await supabase.from('academy_content_public').select('id,published_at');
  if (publicError) throw publicError;
  return { items: data as ContentItem[], published: published as {id: string; published_at: string}[] };
}
export async function saveContent(item: ContentItem, isNew: boolean) {
  const row = {kind:item.kind,payload:item.payload,sort_order:item.sort_order};
  const query = isNew ? supabase.from('academy_content_drafts').insert({...row,id:item.id}) : supabase.from('academy_content_drafts').update(row).eq('id',item.id).eq('version',item.version);
  const { data,error } = await query.select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('تغيّر المحتوى بواسطة مستخدم آخر؛ حدّث القائمة وأعد المحاولة.');
  return data as ContentItem;
}
export async function publishContent(item: ContentItem, visible: boolean) {
  const { error } = await supabase.rpc('publish_academy_content',{content_id:item.id,expected_version:item.version,visible});
  if (error) throw error;
}
export async function readContentHistory(id: string) {
  const {data,error} = await supabase.from('academy_content_revisions').select('id,version,payload,sort_order,action,changed_at,changed_by').eq('content_id',id).order('version',{ascending:false}).limit(30);
  if(error) throw error;
  return data as ContentRevision[];
}

export async function validateContentFile(file: File, video: boolean) {
  const allowed = video ? ['video/mp4'] : ['image/jpeg','image/png','image/webp'];
  if (!allowed.includes(file.type) || file.size <= 0 || file.size > (video ? 20 : 5)*1024*1024) throw new Error(video ? 'اختر فيديو MP4 بحجم أقصى 20 ميجابايت.' : 'اختر صورة JPG أو PNG أو WebP بحجم أقصى 5 ميجابايت.');
  const bytes = new Uint8Array(await file.slice(0,16).arrayBuffer());
  const ascii = (start:number,end:number) => String.fromCharCode(...bytes.slice(start,end));
  const valid = file.type==='image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255
    : file.type==='image/png' ? [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)
    : file.type==='image/webp' ? ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP' : ascii(4,8)==='ftyp';
  if (!valid) throw new Error('محتوى الملف لا يطابق نوعه.');
}
export async function uploadContentFile(file: File, video: boolean) {
  await validateContentFile(file,video);
  const extension = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4'} as Record<string,string>)[file.type];
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
  if(error) throw error;
  return path;
}
