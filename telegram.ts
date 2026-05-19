// ============================================
// Telegram Bot API Helper
// ============================================

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: TgCallbackQuery;
  chat_join_request?: TgChatJoinRequest;
  chat_member?: TgChatMemberUpdated;
  my_chat_member?: TgChatMemberUpdated;
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  sender_chat?: TgChat;
  chat: TgChat;
  date: number;
  text?: string;
  caption?: string;
  reply_to_message?: TgMessage;
  forward_from?: TgUser;
  forward_from_chat?: TgChat;
  forward_origin?: any;
  is_automatic_forward?: boolean;
  message_thread_id?: number;
  is_topic_message?: boolean;
  entities?: TgEntity[];
  caption_entities?: TgEntity[];
  new_chat_members?: TgUser[];
  left_chat_member?: TgUser;
  document?: any;
  photo?: any[];
  video?: any;
  voice?: any;
  audio?: any;
  animation?: any;
  sticker?: any;
}

// معرفات تيليجرام الخاصة:
// 1087968824 = GroupAnonymousBot (مشرفون مجهولون / channel sender)
// 777000     = Telegram Service (رسائل القنوات المُعاد توجيهها إلى مجموعة النقاش)
// 136817688  = ChannelBot (legacy)
export const TG_ANONYMOUS_ADMIN_ID = 1087968824;
export const TG_SERVICE_ID = 777000;
export const TG_CHANNEL_BOT_ID = 136817688;

// التعرف على إذا كانت الرسالة من قناة (linked channel auto-forward)
export function isChannelAutoForward(msg: TgMessage): boolean {
  return !!(msg.is_automatic_forward && msg.sender_chat && msg.sender_chat.type === 'channel');
}

// التعرف على إذا كانت الرسالة من مشرف مجهول
export function isAnonymousAdmin(msg: TgMessage): boolean {
  return !!(msg.sender_chat && msg.sender_chat.id === msg.chat.id);
}

// استخراج ملف من رسالة (يحدد النوع تلقائياً)
export function extractAttachment(msg: TgMessage): {
  file_type: string;
  file_id: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
} | null {
  if (msg.photo && msg.photo.length > 0) {
    const p = msg.photo[msg.photo.length - 1]; // أكبر مقاس
    return {
      file_type: 'photo',
      file_id: p.file_id,
      file_unique_id: p.file_unique_id,
      file_size: p.file_size,
    };
  }
  if (msg.video) {
    return {
      file_type: 'video',
      file_id: msg.video.file_id,
      file_unique_id: msg.video.file_unique_id,
      mime_type: msg.video.mime_type,
      file_name: msg.video.file_name,
      file_size: msg.video.file_size,
    };
  }
  if (msg.animation) {
    return {
      file_type: 'animation',
      file_id: msg.animation.file_id,
      file_unique_id: msg.animation.file_unique_id,
      mime_type: msg.animation.mime_type,
      file_name: msg.animation.file_name,
      file_size: msg.animation.file_size,
    };
  }
  if (msg.audio) {
    return {
      file_type: 'audio',
      file_id: msg.audio.file_id,
      file_unique_id: msg.audio.file_unique_id,
      mime_type: msg.audio.mime_type,
      file_name: msg.audio.file_name,
      file_size: msg.audio.file_size,
    };
  }
  if (msg.voice) {
    return {
      file_type: 'voice',
      file_id: msg.voice.file_id,
      file_unique_id: msg.voice.file_unique_id,
      mime_type: msg.voice.mime_type,
      file_size: msg.voice.file_size,
    };
  }
  if (msg.document) {
    return {
      file_type: 'document',
      file_id: msg.document.file_id,
      file_unique_id: msg.document.file_unique_id,
      mime_type: msg.document.mime_type,
      file_name: msg.document.file_name,
      file_size: msg.document.file_size,
    };
  }
  return null;
}

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TgChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TgEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
}

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}

export interface TgChatJoinRequest {
  chat: TgChat;
  from: TgUser;
  date: number;
  bio?: string;
  invite_link?: any;
}

export interface TgChatMemberUpdated {
  chat: TgChat;
  from: TgUser;
  date: number;
  old_chat_member: any;
  new_chat_member: any;
}

export class Telegram {
  constructor(private token: string) {}

  private async call<T = any>(method: string, params: any = {}): Promise<T> {
    const url = `https://api.telegram.org/bot${this.token}/${method}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data: any = await res.json();
      if (!data.ok) {
        console.error(`Telegram ${method} error:`, data);
        throw new Error(data.description || 'Telegram API error');
      }
      return data.result as T;
    } catch (e: any) {
      console.error(`Telegram ${method} fetch error:`, e?.message);
      throw e;
    }
  }

  // إرسال رسالة
  sendMessage(chat_id: number | string, text: string, extra: any = {}) {
    return this.call('sendMessage', {
      chat_id,
      text,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  // إرسال صورة
  sendPhoto(chat_id: number | string, photo: string, extra: any = {}) {
    return this.call('sendPhoto', {
      chat_id,
      photo,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  // إرسال مستند
  sendDocument(chat_id: number | string, document: string, extra: any = {}) {
    return this.call('sendDocument', {
      chat_id,
      document,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  // إرسال فيديو
  sendVideo(chat_id: number | string, video: string, extra: any = {}) {
    return this.call('sendVideo', {
      chat_id,
      video,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  // إرسال صوت
  sendAudio(chat_id: number | string, audio: string, extra: any = {}) {
    return this.call('sendAudio', {
      chat_id,
      audio,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  // إرسال رسالة صوتية
  sendVoice(chat_id: number | string, voice: string, extra: any = {}) {
    return this.call('sendVoice', {
      chat_id,
      voice,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  // إرسال GIF/Animation
  sendAnimation(chat_id: number | string, animation: string, extra: any = {}) {
    return this.call('sendAnimation', {
      chat_id,
      animation,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  // إرسال ألبوم وسائط
  sendMediaGroup(chat_id: number | string, media: any[]) {
    return this.call('sendMediaGroup', { chat_id, media });
  }

  // ضبط أوامر البوت
  setMyCommands(commands: { command: string; description: string }[], scope?: any) {
    return this.call('setMyCommands', { commands, scope });
  }

  // إرسال ملف عام (يختار الـ method حسب النوع)
  sendAttachment(chat_id: number | string, att: any, caption?: string, extra: any = {}) {
    const params: any = { ...extra };
    if (caption) params.caption = caption;
    switch (att.file_type) {
      case 'photo':
        return this.sendPhoto(chat_id, att.file_id, params);
      case 'video':
        return this.sendVideo(chat_id, att.file_id, params);
      case 'audio':
        return this.sendAudio(chat_id, att.file_id, params);
      case 'voice':
        return this.sendVoice(chat_id, att.file_id, params);
      case 'animation':
        return this.sendAnimation(chat_id, att.file_id, params);
      case 'document':
      default:
        return this.sendDocument(chat_id, att.file_id, params);
    }
  }

  // الرد على CallbackQuery
  answerCallbackQuery(callback_query_id: string, text?: string, show_alert = false) {
    return this.call('answerCallbackQuery', {
      callback_query_id,
      text,
      show_alert,
    });
  }

  // تعديل رسالة
  editMessageText(chat_id: number | string, message_id: number, text: string, extra: any = {}) {
    return this.call('editMessageText', {
      chat_id,
      message_id,
      text,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  // تعديل أزرار رسالة
  editMessageReplyMarkup(chat_id: number | string, message_id: number, reply_markup: any) {
    return this.call('editMessageReplyMarkup', {
      chat_id,
      message_id,
      reply_markup,
    });
  }

  // حذف رسالة
  deleteMessage(chat_id: number | string, message_id: number) {
    return this.call('deleteMessage', { chat_id, message_id });
  }

  // طرد عضو
  banChatMember(chat_id: number | string, user_id: number, until_date?: number) {
    return this.call('banChatMember', { chat_id, user_id, until_date });
  }

  // إزالة الطرد
  unbanChatMember(chat_id: number | string, user_id: number) {
    return this.call('unbanChatMember', { chat_id, user_id, only_if_banned: true });
  }

  // تقييد عضو (كتم)
  restrictChatMember(chat_id: number | string, user_id: number, permissions: any, until_date?: number) {
    return this.call('restrictChatMember', {
      chat_id,
      user_id,
      permissions,
      until_date,
    });
  }

  // الموافقة على طلب انضمام
  approveChatJoinRequest(chat_id: number | string, user_id: number) {
    return this.call('approveChatJoinRequest', { chat_id, user_id });
  }

  // رفض طلب انضمام
  declineChatJoinRequest(chat_id: number | string, user_id: number) {
    return this.call('declineChatJoinRequest', { chat_id, user_id });
  }

  // الحصول على معلومات البوت
  getMe() {
    return this.call('getMe');
  }

  // إعداد Webhook
  setWebhook(url: string, secret_token?: string, drop_pending = false) {
    return this.call('setWebhook', {
      url,
      secret_token,
      drop_pending_updates: drop_pending,
      allowed_updates: [
        'message',
        'edited_message',
        'callback_query',
        'chat_join_request',
        'chat_member',
        'my_chat_member',
      ],
    });
  }

  getWebhookInfo() {
    return this.call('getWebhookInfo');
  }

  deleteWebhook(drop_pending = false) {
    return this.call('deleteWebhook', { drop_pending_updates: drop_pending });
  }

  // الحصول على معلومات عضو في مجموعة
  getChatMember(chat_id: number | string, user_id: number) {
    return this.call('getChatMember', { chat_id, user_id });
  }

  // الحصول على معلومات المجموعة
  getChat(chat_id: number | string) {
    return this.call('getChat', { chat_id });
  }

  // مغادرة المجموعة (البوت يخرج تلقائياً)
  leaveChat(chat_id: number | string) {
    return this.call('leaveChat', { chat_id });
  }

  // الحصول على عدد أعضاء المجموعة
  getChatMemberCount(chat_id: number | string) {
    return this.call('getChatMemberCount', { chat_id });
  }

  // إرسال رسالة إلى المالك مباشرة
  async sendToOwner(owner_id: number, text: string, extra: any = {}) {
    if (!owner_id) return null;
    try {
      return await this.sendMessage(owner_id, text, extra);
    } catch (e) {
      console.error('Failed to send to owner:', e);
      return null;
    }
  }
}

// ====== Helper Functions ======

export function getDisplayName(user: TgUser): string {
  if (user.username) return '@' + user.username;
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || 'مستخدم';
}

export function getFullName(user: TgUser): string {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || 'مستخدم';
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// التحقق من وجود رابط في النص
export function hasLink(text: string, entities?: TgEntity[]): boolean {
  if (entities && entities.length) {
    for (const e of entities) {
      if (['url', 'text_link', 'mention'].includes(e.type)) return true;
    }
  }
  // فحص نمط الروابط في النص
  const linkPattern = /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|@\w{4,})/i;
  return linkPattern.test(text);
}

// التحقق من أن الرسالة محولة
export function isForwarded(msg: TgMessage): boolean {
  return !!(msg.forward_from || msg.forward_from_chat || (msg as any).forward_origin);
}

// تطبيع نص عربي للمقارنة (إزالة التشكيل، توحيد الألف والياء/الهاء، إزالة tatweel)
export function normalizeArabic(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    // إزالة التشكيل (الحركات)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // إزالة tatweel
    .replace(/\u0640/g, '')
    // توحيد الألفات
    .replace(/[إأآا]/g, 'ا')
    // توحيد الياء
    .replace(/[يى]/g, 'ي')
    // توحيد التاء المربوطة والهاء
    .replace(/ة/g, 'ه')
    // إزالة الفواصل الخفية
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    // توحيد المسافات
    .replace(/\s+/g, ' ')
    .trim();
}

// التحقق من احتواء الرسالة على كلمة محظورة (مع تطبيع للعربية)
export function containsBannedWord(
  text: string,
  bannedWords: { word: string; severity?: string }[]
): { word: string; severity: string } | null {
  if (!text || !bannedWords || bannedWords.length === 0) return null;
  const normalized = normalizeArabic(text);
  for (const bw of bannedWords) {
    const word = bw.word || '';
    if (!word.trim()) continue;
    const normWord = normalizeArabic(word);
    if (!normWord) continue;
    // مطابقة في النص المطبّع وأيضاً في النص الأصلي للحالات الإنجليزية
    if (normalized.includes(normWord) || text.toLowerCase().includes(word.toLowerCase())) {
      return { word: bw.word, severity: bw.severity || 'delete' };
    }
  }
  return null;
}
